"use strict";

const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const HOST = "127.0.0.1";
const PORT = 8787;
const ROOT = __dirname;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PARALLEL_JOBS = 2;
const HTML_PAGES = new Set(["code.html", "mock-test.html", "bubble.html", "door-key.html", "game.html"]);
let activeJobs = 0;

function send(response, status, payload, contentType = "application/json; charset=utf-8", protectPage = false) {
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
  if (protectPage) {
    headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  }
  response.writeHead(status, headers);
  response.end(contentType.startsWith("application/json") ? JSON.stringify(payload) : payload);
}

function runProcess(command, args, cwd, timeoutMs, maxOutputBytes = 1024 * 1024, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false });
    child.stdin.end(input, "utf8");
    let stdout = "";
    let stderr = "";
    let totalOutputBytes = 0;
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      reject(new Error(`${path.basename(command)} exceeded the ${Math.round(timeoutMs / 1000)}-second time limit.`));
    }, timeoutMs);

    function collect(target, chunk) {
      totalOutputBytes += chunk.length;
      if (totalOutputBytes > maxOutputBytes) {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          child.kill();
          reject(new Error("Program output exceeded the 1 MB limit."));
        }
        return target;
      }
      return target + chunk.toString("utf8");
    }

    child.stdout.on("data", chunk => { stdout = collect(stdout, chunk); });
    child.stderr.on("data", chunk => { stderr = collect(stderr, chunk); });
    child.once("error", error => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function compileAndRun(source, inputs) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "local-java-practice-"));
  const classPath = directory;
  const userSourcePath = path.join(directory, "UserMainCode.java");
  const harnessPath = path.join(directory, "Main.java");
  const harness = [
    "public class Main {",
    "  public static void main(String[] args) throws Exception {",
    "    int input = Integer.parseInt(args[0]);",
    "    UserMainCode solution = new UserMainCode();",
    "    System.out.print(solution.findingSeven(input));",
    "  }",
    "}"
  ].join("\n");

  try {
    await fs.promises.writeFile(userSourcePath, source, "utf8");
    await fs.promises.writeFile(harnessPath, harness, "utf8");
    const compilation = await runProcess("javac", ["-proc:none", "-encoding", "UTF-8", "-d", directory, userSourcePath, harnessPath], directory, 15000);
    if (compilation.code !== 0) return { compiled: false, stdout: compilation.stdout, stderr: compilation.stderr };

    const tests = [];
    for (const input of inputs) {
      try {
        const result = await runProcess("java", ["-cp", classPath, "Main", String(input)], directory, 3000);
        tests.push({
          input,
          stdout: result.stdout,
          error: result.code === 0 ? "" : result.stderr || `Java process exited with code ${result.code}.`
        });
      } catch (error) {
        tests.push({ input, stdout: "", error: error.message });
      }
    }
    return { compiled: true, stdout: compilation.stdout, stderr: compilation.stderr, tests };
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

async function runSqlQuery(query, check) {
  const runner = [
    "import json, re, sqlite3, sys",
    "payload = json.load(sys.stdin)",
    "query = re.sub(r'(?m)^\\s*--.*$', '', payload['query']).strip()",
    "if not re.match(r'^(SELECT|WITH)\\b', query, re.IGNORECASE):",
    "    print(json.dumps({'ok': False, 'error': 'Only read-only SELECT queries are allowed.'}))",
    "    raise SystemExit(0)",
    "connection = sqlite3.connect(':memory:')",
    "connection.executescript('''",
    "CREATE TABLE employee_info (EMPID TEXT, EMPNAME TEXT, DEPTID TEXT, JOINING_DT TEXT, DOB TEXT, YRS_OF_EXP NUMERIC, EMPLOYEE_CATEGORY TEXT);",
    "CREATE TABLE dept_info (DEPTID TEXT, DEPTNAME TEXT, LOCATION TEXT);",
    "CREATE TABLE emp_leave_info (EMPID TEXT, FROM_DATE TEXT, TO_DATE TEXT, TOTAL_LEAVES NUMERIC, LEAVE_TYPE TEXT);",
    "CREATE TABLE allocated_leave_info (EMPLOYEE_CATEGORY TEXT, CL NUMERIC, EL NUMERIC, ML NUMERIC);",
    "CREATE TABLE salary_info (EMPLOYEE_CATEGORY TEXT, BASIC NUMERIC, TRAVELLING_ALLOWANCE NUMERIC, DEARNESS_ALLOWANCE NUMERIC, HOUSE_RENT_ALLOWANCE NUMERIC, LOCATION_ALLOWANCE NUMERIC, PROVIDENT_FUND NUMERIC, MEDICAL_ALLOWANCE NUMERIC, PROFITAX NUMERIC, INSURANCE NUMERIC);",
    "CREATE TABLE emp_payroll (TRANSNO NUMERIC, EMPID TEXT, _MONTH TEXT, _YEAR NUMERIC, TOTALEARNING NUMERIC, NETPAY NUMERIC);",
    "INSERT INTO dept_info VALUES ('D01','Engineering','New York'), ('D02','Finance','London'), ('D03','Human Resources','Toronto');",
    "INSERT INTO employee_info VALUES ('E001','Priya','D01','2021-06-01','1998-02-11',5,'A'), ('E002','Rahul','D02','2020-03-15','1996-07-22',6,'B'), ('E003','Neha','D01','2019-09-10','1995-12-03',7,'C'), ('E004','Amir','D03','2022-01-20','1999-04-18',4,'B');",
    "INSERT INTO emp_leave_info VALUES ('E001','2026-01-12','2026-01-13',2,'CL'), ('E002','2026-02-03','2026-02-04',2,'EL');",
    "INSERT INTO allocated_leave_info VALUES ('A',12,15,10), ('B',12,15,10), ('C',12,15,10);",
    "INSERT INTO salary_info (EMPLOYEE_CATEGORY, BASIC) VALUES ('A',4500), ('B',6200), ('C',7800);",
    "INSERT INTO emp_payroll (TRANSNO, EMPID, _MONTH, _YEAR, TOTALEARNING, NETPAY) VALUES (1,'E001','September',2026,5000,4300), (2,'E002','September',2026,7200,5900), (3,'E003','September',2026,8900,7400), (4,'E004','September',2026,7200,5800);",
    "''')",
    "allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION}",
    "if hasattr(sqlite3, 'SQLITE_RECURSIVE'): allowed.add(sqlite3.SQLITE_RECURSIVE)",
    "connection.set_authorizer(lambda action, arg1, arg2, database, source: sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY)",
    "steps = [0]",
    "def limit_steps():",
    "    steps[0] += 1",
    "    return 1 if steps[0] > 100000 else 0",
    "connection.set_progress_handler(limit_steps, 1000)",
    "try:",
    "    cursor = connection.execute(query)",
    "    columns = [column[0] for column in cursor.description or []]",
    "    rows = cursor.fetchmany(201)",
    "    if len(rows) > 200:",
    "        raise ValueError('Query returned more than 200 rows; add a filter.')",
    "    result = {'ok': True, 'columns': columns, 'rows': rows}",
    "    if payload.get('check'):",
    "        expected_columns = ['EMPID', 'EMPNAME', 'BASIC', 'NETPAY']",
    "        expected_rows = [['E002','Rahul','6200','5900'], ['E003','Neha','7800','7400'], ['E004','Amir','6200','5800']]",
    "        actual_rows = sorted([[str(value) if value is not None else 'NULL' for value in row] for row in rows])",
    "        result['expectedRows'] = len(expected_rows)",
    "        result['passed'] = [column.upper() for column in columns] == expected_columns and actual_rows == sorted(expected_rows)",
    "    print(json.dumps(result))",
    "except Exception as error:",
    "    print(json.dumps({'ok': False, 'error': str(error)}))",
    "finally:",
    "    connection.close()"
  ].join("\n");
  const execution = await runProcess("python", ["-c", runner], ROOT, 5000, 256 * 1024, JSON.stringify({ query, check }));
  if (execution.code !== 0) {
    throw new Error(execution.stderr || `Python SQL runner exited with code ${execution.code}.`);
  }
  try {
    return JSON.parse(execution.stdout);
  } catch {
    throw new Error("The local SQL runner returned an invalid response.");
  }
}

async function readJson(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request must contain valid JSON."), { status: 400 });
  }
}

function validOrigin(request) {
  const origin = request.headers.origin;
  return !origin || origin === `http://${HOST}:${PORT}`;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  if (!validOrigin(request)) {
    send(response, 403, { error: "Requests must come from the local practice page." });
    return;
  }

  if (request.method === "GET") {
    try {
      const requestedPage = decodeURIComponent(url.pathname.slice(1)) || "code.html";
      if (!HTML_PAGES.has(requestedPage)) {
        send(response, 404, { error: "Not found." });
        return;
      }
      const page = await fs.promises.readFile(path.join(ROOT, requestedPage));
      send(response, 200, page, "text/html; charset=utf-8", requestedPage === "code.html");
    } catch (error) {
      console.error("Could not serve local practice page:", error);
      send(response, 500, { error: "Could not load the requested local practice page." });
    }
    return;
  }

  if (request.method !== "POST" || (url.pathname !== "/api/compile" && url.pathname !== "/api/query")) {
    send(response, 404, { error: "Not found." });
    return;
  }

  if (activeJobs >= MAX_PARALLEL_JOBS) {
    send(response, 429, { error: "The local compiler is busy. Try again shortly." });
    return;
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch (error) {
    send(response, error.status || 400, { error: error.message });
    return;
  }

  if (url.pathname === "/api/query") {
    if (typeof payload.query !== "string" || payload.query.length === 0 || Buffer.byteLength(payload.query, "utf8") > 16 * 1024) {
      send(response, 400, { error: "SQL query must be between 1 byte and 16 KB." });
      return;
    }
    if (typeof payload.check !== "boolean") {
      send(response, 400, { error: "Include whether the query should be checked against the sample output." });
      return;
    }
    activeJobs += 1;
    const jobId = randomUUID();
    try {
      console.log(`[${jobId}] Running SQL practice query (${payload.query.length} characters).`);
      const result = await runSqlQuery(payload.query, payload.check);
      send(response, 200, result);
      console.log(`[${jobId}] SQL query ${result.ok ? "completed" : "failed"}.`);
    } catch (error) {
      console.error(`[${jobId}] Local SQL runner failed:`, error);
      send(response, 500, { error: `Could not run the local SQL query: ${error.message}` });
    } finally {
      activeJobs -= 1;
    }
    return;
  }

  if (typeof payload.source !== "string" || payload.source.length === 0 || Buffer.byteLength(payload.source, "utf8") > 48 * 1024) {
    send(response, 400, { error: "Java source must be between 1 byte and 48 KB." });
    return;
  }
  if (!Array.isArray(payload.inputs) || payload.inputs.length < 1 || payload.inputs.length > 10 ||
      payload.inputs.some(input => !Number.isSafeInteger(input) || input < 1 || input > 2147483647)) {
    send(response, 400, { error: "Provide between 1 and 10 whole-number test inputs from 1 to 2,147,483,647." });
    return;
  }

  activeJobs += 1;
  const jobId = randomUUID();
  try {
    console.log(`[${jobId}] Compiling Java practice submission (${payload.source.length} characters).`);
    const result = await compileAndRun(payload.source, payload.inputs);
    send(response, 200, result);
    console.log(`[${jobId}] Finished: ${result.compiled ? "compiled" : "compile error"}.`);
  } catch (error) {
    console.error(`[${jobId}] Local Java compiler failed:`, error);
    send(response, 500, { error: `Could not run the local Java compiler: ${error.message}` });
  } finally {
    activeJobs -= 1;
  }
});

server.on("error", error => {
  console.error("Could not start the local practice server:", error);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Java coding practice is ready at http://${HOST}:${PORT}/code.html`);
  console.log(`This server runs submitted Java code on this computer as ${os.userInfo().username}.`);
  console.log("Stop the server with Ctrl+C when finished.");
});

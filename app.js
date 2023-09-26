const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
let db = null;
app.use(express.json());

const convert = (dbResponse) => {
  return {
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
  };
};
const convert1 = (dbResponse) => {
  return {
    districtId: dbResponse.district_id,
    districtName: dbResponse.district_name,

    stateId: dbResponse.state_id,
    cases: dbResponse.cases,
    cured: dbResponse.cured,
    active: dbResponse.active,
    deaths: dbResponse.deaths,
  };
};
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started");
    });
  } catch (e) {
    console.log("DB Error");
    process.exit(1);
  }
};
initializeDbAndServer();
app.post("/register", async (request, response) => {
  const { username, name, password, gender, location } = request.body;

  const hashPassword = await bcrypt.hash(password, 10);
  const query = `select * from user where username='${username}';`;
  const dbResponse = await db.get(query);
  if (dbResponse === undefined) {
    const createUser = `insert into user(username,name,password,gender,location)
            values('${username}','${name}','${hashPassword}','${gender}','${location}');`;
    if (password.length < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      await db.run(createUser);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const query2 = `select * from user where username='${username}';`;
  const dbResponse2 = await db.get(query2);

  if (dbResponse2 === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(
      password,
      dbResponse2.password
    );
    if (isPasswordMatch === true) {
      const payload = { username: username };
      let jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
app.get("/states/", authenticateToken, async (request, response) => {
  const query4 = `select * from state;`;
  const dbResponse3 = await db.all(query4);

  response.send(dbResponse3.map((eachState) => convert(eachState)));
});
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const query5 = `select * from state where state_id=${stateId};`;
  const dbResponse5 = await db.get(query5);
  response.send(convert(dbResponse5));
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query7 = `select * from district where district_id=${districtId};`;
    const dbResponse7 = await db.get(query7);
    response.send(convert1(dbResponse7));
  }
);
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query11 = `delete from district where district_id=${districtId};`;
    const dbResponse11 = await db.run(query11);
    response.send("District Removed");
  }
);
app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const query22 = `update district set 
  district_id=${districtId},
  district_name='${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths} where district_id=${districtId};`;
    const dbResponse22 = await db.run(query22);
    response.send("District Details Updated");
  }
);
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const query6 = `insert into district (district_name,state_id,cases,cured,active,deaths)
    values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const dbResponse6 = await db.run(query6);
  response.send("District Successfully Added");
});
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const query33 = `select sum(cases) ,sum(cured),
    sum(active) ,
sum(deaths)  from district where state_id=${stateId};`;
    const dbResponse33 = await db.get(query33);
    response.send({
      totalCases: dbResponse33["sum(cases)"],
      totalCured: dbResponse33["sum(cured)"],
      totalActive: dbResponse33["sum(active)"],
      totalDeaths: dbResponse33["sum(deaths)"],
    });
  }
);
module.exports = app;

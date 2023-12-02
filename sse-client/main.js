const SSEResponseRuuter = require("./SSEResponseRuuter");

const hostUrl = "http://localhost:3001";
const ruuter = SSEResponseRuuter(`${hostUrl}/events`);

ruuter.get("/params/:id", (req, res, next) => {
    console.log(`Get Params ${JSON.stringify(req.params)}; Query: ${JSON.stringify(req.query)}`);

    res.json({ hey: req.params });
});

ruuter.post("/params/:id", (req, res, next) => {
    console.log(`Post Params ${JSON.stringify(req.params)}; Query: ${JSON.stringify(req.query)}; Body: ${JSON.stringify(req.body)}`);

    res.json({ params: req.params, query: req.query, body: req.body });
});

ruuter.get("/endpoint", (req, res, next) => {
    console.log("gone through once");
    next();
}, (req, res, next) => {
    console.log("gone through twice, saying hi");
    res.send('hi');
});

ruuter.get("/performcalc/:a/:b", (req, res) => {
    const { query, params } = req;
    const method = query.method || "add";
    const { a: _a = 1, b: _b = 1 } = params;

    const a = parseFloat(_a);
    const b = parseFloat(_b);

    if (method.includes("add"))
        res.send(a + b);
    else if (method.includes("sub"))
        res.send(a - b);
    else if (method.includes("mul"))
        res.send(a * b);
    else if (method.includes("div"))
        res.send(a / b);
    else
        res.status(500).send("Operation not found");
});


ruuter.start();
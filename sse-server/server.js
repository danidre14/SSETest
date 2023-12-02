const express = require("express");
const cors = require('cors');
const SSERequestRuuter = require("./SSERequestRuuter");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ruuter = SSERequestRuuter(app, "/events");
app.get("/calc/:a/:b", async (req, res) => {
    const { query, params } = req;
    try {
        const result = await ruuter.fetch(`/performcalc/${params.a}/${params.b}?method=${query.method || "add"}`, {}, { ttl: 10 });
        res.status(200).json(result);
    } catch (err) {
        res.status(200).json(`Error doing calculation: ${err}`);
    }
});




const PORT = 3001;

app.listen(PORT, () => {
    console.log("Service listening on " + PORT);

    ruuter.on("connect", async () => {
        try {
            const res = await ruuter.fetch("/endpoint");
            console.log(`Response from ruuter get fetch is: ${JSON.stringify(res)}`);
        } catch (err) {
            console.log("Error ruuter fetching: " + (err));
        }

        try {
            const res = await ruuter.fetch("/params/34", { sick: 3 });
            console.log(`Response from ruuter get fetch params is: ${JSON.stringify(res)}`);
        } catch (err) {
            console.log("Error ruuter fetching get params: " + (err));
        }

        try {
            const res = await ruuter.fetch("/params/34?query1=1&query2=two&queryx=x", { sick: 3 }, {method: "POST"});
            console.log(`Response from ruuter post fetch params is: ${JSON.stringify(res)}`);
        } catch (err) {
            console.log("Error ruuter fetching post params: " + (err));
        }
    });
});


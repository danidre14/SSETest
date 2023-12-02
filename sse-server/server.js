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
        const result = await ruuter.fetch(`/performcalc/${params.a}/${params.b}?method=${query.method || "add"}`, {}, {ttl:10});
        res.status(200).json(result);
    } catch (err) {
        res.status(200).json(`Error doing calculation: ${err}`);
    }
});




const PORT = 3001;

app.listen(PORT, () => {
    console.log("Service listening on " + PORT);

    let time = 0;
    const int = setInterval(async () => {
        if (time > 0)
            return clearInterval(int);
        if (ruuter.active) {
            time++;

            try {
                const res = await ruuter.fetch("/endpoint");
                console.log(`Response from ruuter fetch is: ${JSON.stringify(res)}`);
            } catch (err) {
                console.log("Error ruuter fetching: " + (err));
            }

            try {
                const res = await ruuter.fetch("/params/34", { sick: 3 });
                console.log(`Response from ruuter fetch ahoy is: ${JSON.stringify(res)}`);
            } catch (err) {
                console.log("Error ruuter fetching ahoy: " + (err));
            }
        }

    }, 2000);
});


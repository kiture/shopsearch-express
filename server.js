const fetch = require("node-fetch");
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const express = require("express");
const bodyParser = require('body-parser');
const cors = require('cors');
const jsdom = require("jsdom");
const fs = require('fs');
const {JSDOM} = jsdom;

const ALLEGRO_CLIENT_ID = "aea655fde4f04b349a4bbad8102296a3";
const ALLEGRO_CLIENT_SECRET = "MVe8KDA305fHqWZrtzY9Ce3maTJ2bDTVdmfTEbnNAThLtFUsF1VsU6YELDYuVfLE";
const ALLEGRO_API_URL = "https://api.allegro.pl";
const OLX_URL = "https://www.olx.pl";

let tokenType;
let accessToken;

const dbAllegro = low(new FileSync('allegroCategories.json'));
const dbOlx = low(new FileSync('olxCategories.json'));
const app = express();

async function generateAllegroToken() {
    let response = await fetch("https://allegro.pl/auth/oauth/token?grant_type=client_credentials", {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + Buffer.from(ALLEGRO_CLIENT_ID + ':' + ALLEGRO_CLIENT_SECRET).toString('base64')
        }
    });
    let json = await response.json();
    tokenType = json.toke_type;
    accessToken = json.access_token;
}

async function makeAllegroReq(req, res, url) {
    let rawQuery = "";
    for (let a in req.query) {
        rawQuery += `${a}=${req.query[a]}&`;
    }
    let response = await fetch(`${url}?${rawQuery}`, {
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + accessToken,
            Accept: "application/vnd.allegro.public.v1+json"
        }
    });
    let json = await response.json();
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(json));
}

app.use(cors());
app.use(express.static('client'));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.json({limit: '50mb', extended: true}));

app.get("/olx/categories", (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(dbOlx.read().value()));
});

app.get('/allegro/categories', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(dbAllegro.read().value()));
});

app.get('/allegro/offers', (req, res) => {
    if (!tokenType) {
        generateAllegroToken().then(() => makeAllegroReq(req, res, ALLEGRO_API_URL + "/offers/listing"));
    } else {
        makeAllegroReq(req, res, ALLEGRO_API_URL + "/offers/listing")
    }
});

app.get("/olx/offers", async (req, res) => {
    let url = `${OLX_URL}/${req.query["path"]}`;
    let offers = await findOlxOffer(url, 1);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(offers));
});

app.post("/items/save", (req, res) => {
    let user = req.query["user"];
    let item = req.body;
    let userFile = getUserFile(user);
    let found = false;
    for (let i = 0; i < userFile.items.length; ++i)
    {
        if (userFile.items[i].id === item.id) {
            userFile.items[i] = item;
            found = true;
            break;
        }
    }
    if (!found) {
        userFile.items.push(item);
    }
    saveUserFile(user, userFile);
    res.setHeader('Content-Type', 'text/html');
    res.send("success");
});

app.post("/olx/city/save", (req, res) => {
    let user = req.query["user"];
    let cities = req.body;
    let userFile = getUserFile(user);
    userFile.olxCities = cities;
    saveUserFile(user, userFile);
    res.setHeader('Content-Type', 'text/html');
    res.send("success");
});

app.get("/", (req, res) => {
    res.send("Working");
});

app.listen(8080, () => {
    console.log("started express server")
});

function saveUserFile(user, userJson) {
    let filePath = `client/${user}.json`;
    let fileContent = JSON.stringify(userJson);
    fs.writeFileSync(filePath, fileContent);
}

function getUserFile(user) {
    let filePath = `client/${user}.json`;
    if (!fs.existsSync(filePath)) {
        fs.openSync(filePath, "w");
    }
    let fileContent = fs.readFileSync(filePath);
    try {
        return JSON.parse(fileContent)
    } catch (e) {
        return {
            items: [],
            olxCities: []
        };
    }
}

async function findOlxOffer(url, pageNr) {
    let response = await fetch(`${url}?page=${pageNr}&spellchecker=off`);
    let pageBody = await response.text();
    const dom = new JSDOM(pageBody);
    let offers = [];
    if (dom.window.document.getElementsByClassName("emptynew  large lheight18").length > 0) {
        return offers;
    }
    let rawOffers = dom.window.document.getElementsByClassName("offerData");
    for (let a in rawOffers) {
        try {
            if (!rawOffers[a].getElementsByTagName) {
                continue;
            }
            let offer = {imgUrl: ""};
            let img = rawOffers[a].getElementsByTagName("img");
            if (img && img[0]) {
                offer.imgUrl = img[0].src;
            }
            let rawTitlePrice = rawOffers[a].getElementsByTagName("strong");
            if (isEmpty(rawTitlePrice)) {
                continue;
            }
            offer.title = rawTitlePrice["0"].innerHTML;
            let rawPrice = rawTitlePrice["1"].innerHTML;
            offer.price = rawPrice.split(" ")[0];
            offer.id = rawOffers[a].getElementsByTagName("table")["0"].dataset.id;
            offer.url = rawOffers[a].getElementsByTagName("a")["0"].href;
            offer.city = rawOffers[a].getElementsByClassName("space rel")[2].getElementsByTagName("span")[0].innerHTML;
            offer.city = offer.city.substring(offer.city.indexOf("</i>") + 4).split(",")[0];
            offer.isDelivery = rawOffers[a].getElementsByClassName("olx-delivery-icon").length > 0;
            offers.push(offer);
        } catch (e) {
            console.log("error during parsing olx offerData ", e)
        }
    }
    let nextPageElement = dom.window.document.getElementsByClassName("fbold next abs large");
    if (nextPageElement && nextPageElement.length > 0) {
        let hasNextPage = nextPageElement[0].getElementsByTagName("a").length > 0;
        if (hasNextPage) {
            offers = offers.concat(await findOlxOffer(url, pageNr + 1));
        }
    }
    return offers;
}

function isEmpty(obj) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop))
            return false;
    }

    return true;
}

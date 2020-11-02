function urlParam(p) {
    var query  = location.search.replace(/^\?/, "");
    var data   = query.split("&");
    var result = [];
    var i, item;

    for (i = 0; i < data.length; i++) {
        item = data[i].split("=");
        if (item[0] === p) {
            return decodeURIComponent(item[1].replace(/\+/g, '%20'));
        }
    }

    return null;
}

function getRedirectURI() {
    return (location.protocol + "//" + location.host + location.pathname)
        .match(/(.*\/)[^\/]*/)[1];
}

function refreshApp() {
    location.href = getRedirectURI();
}

function initialize(settings) {
    setSettings({
        client_id     : settings.client_id,
        secret        : settings.secret,
        scope         : settings.scope + " launch",
        launch_id     : urlParam("launch"),
        api_server_uri: urlParam("iss")
    });
    clearAuthToken();
    refreshApp();
}

function completeAuth() {
    FHIR.oauth2.ready().then(refreshApp);
}

function writeData (key, data) {
    sessionStorage[key] = JSON.stringify(data);
}

function readData(key) {
    var data = sessionStorage[key];
    if (data) {
        return JSON.parse(data);
    }
    return data;
}

function getSettings() {
    return readData("app-settings");
}

function setSettings(data) {
    writeData("app-settings", data);
}

function hasAuthToken() {
    var smartKey = readData("SMART_KEY");
    var state = readData(smartKey);

    return (typeof state === 'object') && (state.tokenResponse !== undefined);
}

function clearAuthToken() {
    var smartKey = readData("SMART_KEY");
    var state = readData(smartKey);

    if(typeof state === 'object') {
        delete state.tokenResponse
        writeData(smartKey, state)
    }
}

function getHumanName(name) {
    return name.given.join(" ") + " " + name.family.join(" ");
}

function authorize() {
    var settings = getSettings();

    FHIR.oauth2.authorize({
        "client_id": settings.client_id,
        "scope"    : settings.scope,
        "launch"   : settings.launch_id,
        "iss"      : settings.api_server_uri
    });
}

function fetchPatientName () {
    var ret = $.Deferred();

    FHIR.oauth2.ready()
    .then(function(smart) {
        smart.patient.read()
        .then(function(patient) {
            ret.resolve(getHumanName(patient.name[0]))
        })
        .catch(function(e) {
            ret.reject("Could not fetch patient name");
        });
    });

    return ret.promise();
}

function getUserName() {
    var ret = $.Deferred();

    FHIR.oauth2.ready()
    .then(function(smart){    
        smart.user.read()
        .then(function(pt) {
            if (pt) {
                var name;
                if (pt.resourceType === "Practitioner" || pt.resourceType === "RelatedPerson") {
                    ret.resolve(getHumanName(pt.name));
                }
                else if (pt.resourceType === "Patient") {
                    ret.resolve(getHumanName(pt.name[0]));
                }
                else {
                    ret.reject("Could not fetch user name");
                }
            }
            else {
                ret.resolve(pt);
            }
        })
        .catch(function(error) {
            window.SMART = smart
            console.log(smart)
            ret.reject("Could not fetch user name: " + error);
        });
    });

    return ret.promise();
}
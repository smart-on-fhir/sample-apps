function urlParam(p) {
  var query = location.search.substr(1);
  var data = query.split("&");
  var result = [];

  for(var i=0; i<data.length; i++) {
    var item = data[i].split("=");
    if (item[0] === p) {
      result.push(decodeURIComponent(item[1]));
    }
  }

  if (result.length === 0){
    return null;
  }
  return result[0];
}

function getRedirectURI () {
    return (window.location.protocol + "//" + window.location.host + window.location.pathname).match(/(.*\/)[^\/]*/)[1];
}

function refreshApp () {
    window.location.href = getRedirectURI();
}

function initialize (settings) {

    setSettings({
        client_id: settings.client_id,
        scope: settings.scope + " launch:" + urlParam("launch"),
        api_server_uri: urlParam("iss")
    });
    clearAuthToken();
    refreshApp();
}

function completeAuth () {
    $.when(fetchToken()).then(function () {
        refreshApp();
    });
}

function writeData (key, data) {
    sessionStorage[key] = JSON.stringify(data);
}

function readData (key) {
    var data = sessionStorage[key];
    if (data) {
        return JSON.parse(sessionStorage[key]);
    } else {
        return data;
    }
}

function clearData (key) {
    delete sessionStorage[key];
}

function getAuthToken () {
    return readData("auth-token");
}

function setAuthToken (data) {
    writeData ("auth-token", data);
}

function clearAuthToken () {
    clearData("auth-token");
}

function getSettings () {
    return readData("app-settings");
}

function setSettings (data) {
    writeData ("app-settings", data);
}

function getSession (key) {
    return readData(key);
}

function setSession (data) {
    var key = Math.round(Math.random()*100000000).toString();
    writeData (key, data);
    return key;
}

function hasAuthToken () {
    return getAuthToken () !== undefined;
}

function fetchToken () {
    var differed = $.Deferred();
    var settings = getSettings ();
    var state = urlParam("state");
    var code = urlParam("code");
    var params = getSession (state);

    $.ajax({
        url: params.token_uri,
        type: 'POST',
        data: {
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: getRedirectURI(),
            client_id: settings.client_id
        },
    }).done(function(res){
        setAuthToken({
            patient_id: res.patient,
            access_token: res.access_token
        });
        differed.resolve ();
    });
    
    return differed.promise();
}

function authorize () {
    var settings = getSettings ();
    
    $.get(
        settings.api_server_uri+"/metadata",
        function(r){
            var authorize_uri = null;
            var token_uri = null;

            jQuery.each(r.rest[0].security.extension, function(responseNum, arg){
              if (arg.url === "http://fhir-registry.smarthealthit.org/Profile/oauth-uris#authorize") {
                authorize_uri = arg.valueUri;
              } else if (arg.url === "http://fhir-registry.smarthealthit.org/Profile/oauth-uris#token") {
                token_uri = arg.valueUri;
              }
            });
            
            var state = setSession({
                token_uri: token_uri
            });

            var redirect_to=authorize_uri + "?" + 
                "client_id="+settings.client_id+"&"+
                "response_type=code&"+
                "scope="+settings.scope+"&"+
                "redirect_uri="+getRedirectURI() + "&" +
                "state=" + state;
            
            window.location.href = redirect_to;
        },
        "json"
    );
}

function getPatientName () {
    var ret = $.Deferred();
    var api_server_uri = getSettings().api_server_uri;
    var patient_id = getAuthToken().patient_id;
    var access_token = getAuthToken().access_token;
    var url = api_server_uri + '/Patient/' + patient_id;
      

    $.ajax({
        type: 'GET',
        url: url,
        dataType: 'json',
        headers: {
            'Authorization': "Bearer " + access_token
        }
    })
    .done(function(pt){
        var name = pt.name[0].given.join(" ") +" "+ pt.name[0].family.join(" ");
        ret.resolve(name);
    })
    .fail(function(){
        ret.reject("Could not fetch " + url);
    });

    return ret.promise();
}

module.exports = function(inputData, callback) {

    /* PRINCIPLES ############################################ */
    // 1. API'S URL:
    // 1a.Parts of the url:
    wd = "https://www.wikidata.org/w/api.php?";
    wp = "https://en.wikipedia.org/w/api.php?"; // list of iso-code = ? ----------------<
    aw = "action=wbgetentities" ; // rather wdpoint
    aq = "action=query" ; // ?rather wppage
    ts = "&sites=enwiki" ; // wd only&required. // list of wiki-code = ? --------------<
    t = "&titles=" // target, wd|wp
    i = "Montreal"; //item, wd|wp
    // i_ht = "＊～米字鍵～" ; // wdpoint|wppage -- +few data
    // i_hs = "＊～米字键～" ; // wdpoint: missing; wppage: redirect (confirmed)
    // i_ht = "中國" ; // wdpoint|wppage -- +many data
    // i_hs = "中国" ; // wdpoint: missing; wppage: redirect (idem)
    l  = "&languages=zh|zh-classical|zh-cn|zh-hans|zh-hant|zh-hk|zh-min-nan|zh-mo|zh-my|zh-sg|zh-tw|fr" ; // wdpoint only
    ps = "&props=sitelinks|labels|aliases|descriptions" ; // wdpoint only
    //sitelinks: all interwikis
    //labels: title without _(tag), for l (languages) only
    //aliases: label of redirect page
    p = "&prop=extracts&exintro&explaintext&exsentences=10" ; // wppage only
    r = "&redirects&converttitles" ; // wppage only
    c = "&callback=?" ;// wd|wp
    f = "&format=json" ;// wd|wp

    let input = inputData;
    let finalR = "";

    //1b. Compose your url:
    urlwd = wd+aw+ts+t+i+l+ps    +c+f; // typical wd query
    urlwp   = wp+aq   +t+i     +p+r+c+f; // typical wp query
    // Examples print in console:
    // console.log("1. WD: "+urlwd);
    // console.log("2. WP: "+urlwp);

    /* translate *********************************************** */
    // var wikidata_translate = function (item,isolang) {
    //     var url = wd+aw+ts+t+item+l+ps    +c+f, // typical wd query
    //         iso = isolang+"wiki",
    //         trad="";
    //     console.log(url);
    //     $.getJSON(url, function (json) {
    //         trad =  json.entities[ Object.keys(json.entities)[0] ].sitelinks[iso].title;
    //             console.log("1"+trad);
    //     })
    // //return trad +"y2"+toto;
    // };
    // console.log(wikidata_translate("Dragon", "zh") /**/)

    //1c. DOM injection:
    //$("body").html('<a href="'+url+'">Link</a>.<br />'+ url); //publish the url.
    // wd+i INconsistently provide variants.

    /* DEMO ################################################## */
    /* 2. TEMPLATING ***************************************** */
    // 2a. Single query :
    function WP(item) {
        url   = wp+aq+t+ item +p+r+c+f;  console.log(url);
        $.getJSON(url, function (json) {
            var item_id = Object.keys(json.query.pages)[0]; // THIS DO THE TRICK !
            var extract = json.query.pages[item_id].extract;
            var result = "<b>En :</b> <t>" + item + "</t> <b>⇒</b> " + extract;
            // $('#anchor1').append("<div>"+result+"</div>"); // append
            // console.log(result);
            finalR = result;
            return callback(finalR);
        });
    }; 
    WP(input);


};



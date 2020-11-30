(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';
var analyserFrequency = require('analyser-frequency-average');

module.exports = function(audioContext, stream, opts, sourceAudio) {

  opts = opts || {};

  var defaults = {
    fftSize: 1024,
    bufferLen: 1024,
    smoothingTimeConstant: 0.2,
    minCaptureFreq: 85,         // in Hz
    maxCaptureFreq: 255,        // in Hz
    noiseCaptureDuration: 1000, // in ms
    minNoiseLevel: 0.3,         // from 0 to 1
    maxNoiseLevel: 0.7,         // from 0 to 1
    avgNoiseMultiplier: 1.2,
    onVoiceStart: function() {
    },
    onVoiceStop: function() {
    },
    onUpdate: function(val) {
    }
  };

  var options = {};
  for (var key in defaults) {
    options[key] = opts.hasOwnProperty(key) ? opts[key] : defaults[key];
  }

  var baseLevel = 0;
  var voiceScale = 1;
  var activityCounter = 0;
  var activityCounterMin = 0;
  var activityCounterMax = 60;
  var activityCounterThresh = 5;

  var envFreqRange = [];
  var isNoiseCapturing = true;
  var prevVadState = undefined;
  var vadState = false;
  var captureTimeout = null;

  var source = sourceAudio;
  // var source = audioContext.createMediaElementSource(stream);
  // var source = audioContext.createMediaStreamSource(stream);
  var analyser = audioContext.createAnalyser();
  analyser.smoothingTimeConstant = options.smoothingTimeConstant;
  analyser.fftSize = options.fftSize;

  var scriptProcessorNode = audioContext.createScriptProcessor(options.bufferLen, 1, 1);
  connect();
  scriptProcessorNode.onaudioprocess = monitor;

  if (isNoiseCapturing) {
    //console.log('VAD: start noise capturing');
    captureTimeout = setTimeout(init, options.noiseCaptureDuration);
  }

  function init() {
    //console.log('VAD: stop noise capturing');
    isNoiseCapturing = false;

    envFreqRange = envFreqRange.filter(function(val) {
      return val;
    }).sort();
    var averageEnvFreq = envFreqRange.length ? envFreqRange.reduce(function (p, c) { return Math.min(p, c) }, 1) : (options.minNoiseLevel || 0.1);

    baseLevel = averageEnvFreq * options.avgNoiseMultiplier;
    if (options.minNoiseLevel && baseLevel < options.minNoiseLevel) baseLevel = options.minNoiseLevel;
    if (options.maxNoiseLevel && baseLevel > options.maxNoiseLevel) baseLevel = options.maxNoiseLevel;

    voiceScale = 1 - baseLevel;

    //console.log('VAD: base level:', baseLevel);
  }

  function connect() {
    source.connect(analyser);
    analyser.connect(scriptProcessorNode);
    scriptProcessorNode.connect(audioContext.destination);
  }

  function disconnect() {
    scriptProcessorNode.disconnect();
    analyser.disconnect();
    source.disconnect();
  }

  function destroy() {
    captureTimeout && clearTimeout(captureTimeout);
    disconnect();
    scriptProcessorNode.onaudioprocess = null;
  }

  function monitor() {
    var frequencies = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencies);

    var average = analyserFrequency(analyser, frequencies, options.minCaptureFreq, options.maxCaptureFreq);
    if (isNoiseCapturing) {
      envFreqRange.push(average);
      return;
    }

    if (average >= baseLevel && activityCounter < activityCounterMax) {
      activityCounter++;
    } else if (average < baseLevel && activityCounter > activityCounterMin) {
      activityCounter--;
    }
    vadState = activityCounter > activityCounterThresh;

    if (prevVadState !== vadState) {
      vadState ? onVoiceStart() : onVoiceStop();
      prevVadState = vadState;
    }

    options.onUpdate(Math.max(0, average - baseLevel) / voiceScale);
  }

  function onVoiceStart() {
    options.onVoiceStart();
  }

  function onVoiceStop() {
    options.onVoiceStop();
  }

  return {connect: connect, disconnect: disconnect, destroy: destroy};
};
},{"analyser-frequency-average":2}],2:[function(require,module,exports){
var frequencyToIndex = require('audio-frequency-to-index')

module.exports = analyserFrequencyAverage.bind(null, 255)
module.exports.floatData = analyserFrequencyAverage.bind(null, 1)

function analyserFrequencyAverage (div, analyser, frequencies, minHz, maxHz) {
  var sampleRate = analyser.context.sampleRate
  var binCount = analyser.frequencyBinCount
  var start = frequencyToIndex(minHz, sampleRate, binCount)
  var end = frequencyToIndex(maxHz, sampleRate, binCount)
  var count = end - start
  var sum = 0
  for (; start < end; start++) {
    sum += frequencies[start] / div
  }
  return count === 0 ? 0 : (sum / count)
}

},{"audio-frequency-to-index":3}],3:[function(require,module,exports){
var clamp = require('clamp')

module.exports = frequencyToIndex
function frequencyToIndex (frequency, sampleRate, frequencyBinCount) {
  var nyquist = sampleRate / 2
  var index = Math.round(frequency / nyquist * frequencyBinCount)
  return clamp(index, 0, frequencyBinCount)
}

},{"clamp":4}],4:[function(require,module,exports){
module.exports = clamp

function clamp(value, min, max) {
  return min < max
    ? (value < min ? min : value > max ? max : value)
    : (value < max ? max : value > min ? min : value)
}

},{}],5:[function(require,module,exports){
(function () {
    "use strict";
    // Declaring variables
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var vad = require('../index.js');
    var wiki = require('../wiki.js');
    var introduction = false;
    var newChannel = false;
    var audioSrc;
    var audio2Src;
    var jdata = [];
    var counter = 0;
    var counter2 = 0;
    var vadVal;
    var vadValCounter;
    var vadValAverage;
    var txt;
    var i = 0;
    var context = new AudioContext();
    // var context = new (window.AudioContext || window.webkitAudioContext)();
    var audio = new Audio();
    var audio2 = new Audio();
    var audio3 = new Audio();
    audio3.src = "./source/Audio/radio.mp3";
    audio3.volume = 0.5;
    var sourceAudio = context.createMediaElementSource(audio2);
    var volume = context.createGain();
    const introDiv = document.getElementById("intro");
    const cesiumContainerDiv = document.getElementById("cesiumContainer");
    const button = document.getElementById('my-button'); // add id="my-button" into html
    const wikiInfoDiv = document.getElementById('wikiInfo');
    const radioTower = document.getElementById('radioTower');
    const loading = document.getElementById('loading');

    // Hide elements before getting the json file
    introDiv.style.display = "none";
    cesiumContainerDiv.style.display = "none";
    radioTower.style.display = "none";
    wikiInfoDiv.style.display = "none";
    loading.style.display = "none";

    // Getting the JSON file and shuffling the array for random results
    fetch("./Source/radios.json")
    .then(function(resp) {
        return resp.json();
    })
    .then(function(data) {
        jdata = data;
        shuffle(jdata);
        gotData();
    });

    // Initializing the map and showing the start button after getting the data
    function gotData() {
        console.log(jdata);
        mapInitPos();
        billboard();
        introDiv.style.display = "block";
        button.addEventListener('click', buttonClick);
    }

    // Starting the audio after clicking start
    function buttonClick() {
        radioTest();
        cesiumContainerDiv.style.display = "block";
        button.style.display = "none";
        loading.style.display = "block";
        disableInputs();
    }

    // Function that add a red dot at targets location
    function billboard() {
        viewer.entities.add({
            position: new Cesium.Cartesian3.fromDegrees(jdata[counter].loc[0], jdata[counter].loc[1], 1),
            billboard: {
                image: "./Source/Images/dot.png",
                scale: 0.01
            },
        });
    }


    // Function that flies to a new location every 15 seconds
    function change() {
        audio3.pause();
        audio3.currentTime = 0;
        introDiv.style.display = "none";
        radioTower.style.display = "none";
        console.log("change: counter = "+counter);
        wiki(jdata[counter].city, function(response){
            console.log(response);
            wikiInfoDiv.innerHTML = "";
            txt = response;
            // $("#wikiInfo").append(response);// append
            // $("#wikiInfo").append("<div>"+response+"</div>");// append
            wikiInfoDiv.style.display = "block";
            typeWriter();
        });
        viewer.scene.camera.flyTo({
            destination: new Cesium.Cartesian3.fromDegrees(jdata[counter].loc[0], jdata[counter].loc[1], jdata[counter].loc[2]),
            duration: 15,
            complete: flyEnd
        });
        viewer.entities.add({
            position: new Cesium.Cartesian3.fromDegrees(jdata[counter].loc[0], jdata[counter].loc[1], 1),
            billboard: {
                image: "./Source/Images/dot.png",
                scale: 0.01
            },
        });

        let myTimeout = setTimeout(function() {
            introduction = false;
            // change();
        }, 30000);
    }

    // Shuffle an array
    function shuffle(array) {
        var currentIndex = array.length, temporaryValue, randomIndex;
      
        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
      
          // Pick a remaining element...
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
      
          // And swap it with the current element.
          temporaryValue = array[currentIndex];
          array[currentIndex] = array[randomIndex];
          array[randomIndex] = temporaryValue;
        }
      
        return array;
    }

    function typeWriter() {
        console.log("typing")
        if (i < txt.length) {
            // wikiInfoDiv.innerHTML += txt.charAt(i);
            if(txt[i] == "<" && txt[i+1] != "/"){
                $("#wikiInfo").append(txt[i]+txt[i+1]+txt[i+2]);
                i += 3;
            }
            else if(txt[i] == "<" && txt[i+1] == "/"){
                $("#wikiInfo").append(txt[i]+txt[i+1]+txt[i+2]+txt[i+3]);
                i += 4;
            }
            else {
                $("#wikiInfo").append(txt[i]);
                i++;
            }
            setTimeout(typeWriter, 5);
        }
        else if (i = txt.length) {
            i = 0;
        }
    }


    // START OF MAP STUFF
    // TODO: Add your ion access token from cesium.com/ion/
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhNDk1NWQyYi1kNWE5LTRkZGItODkwYi0wYzJjOTIyY2M5ZmQiLCJpZCI6Mzg1MDAsImlhdCI6MTYwNjQwNTIwM30.I_5HwvHH-VkeEJ-ie5jVhUvXWYbfIgorktV9TAVc8LU';

    //////////////////////////////////////////////////////////////////////////
    // Creating the Viewer
    //////////////////////////////////////////////////////////////////////////
    // var osm = new Cesium.createOpenStreetMapImageryProvider({
    //     url : 'https://a.tile.openstreetmap.org/'
    // });

    var viewer = new Cesium.Viewer('cesiumContainer', {
        scene3DOnly: true,
        selectionIndicator: false,
        baseLayerPicker: true,
        homeButton: false,
        timeline: false,
        geocoder: true,
        navigationHelpButton: false,
        animation: false,
        creditContainer: "creditContainer",
        fullscreenButton: false,
        shadows: true
    });

    function flyEnd() {
        radioTower.style.display = "block";
        // radioTower.src = "/source/Images/radioGif.gif";
        radioTower.src = radioTower.src.replace(/\?.*$/,"")+"?x="+Math.random();
        disableInputs();
        viewer.scene.camera.flyTo({
            destination: new Cesium.Cartesian3.fromDegrees(jdata[counter].loc[0], jdata[counter].loc[1], jdata[counter].loc[2]-1000),
            duration: 20
        });
    }

    function disableInputs() {
        // for some reason the flyTo function enables inputs at the end after the call of this function
        // Disabling it one 1ms after seems to fix this issues
        setTimeout(function(){
            viewer.scene.screenSpaceCameraController.enableInputs = false;
            // console.log("inputs disabled");
        },1)
    }

    function mapInitPos() {
        // // // Create an initial camera view
        var initialPosition = new Cesium.Cartesian3.fromDegrees(jdata[0].loc[0], jdata[0].loc[1], 10000000);
        var initialOrientation = new Cesium.HeadingPitchRoll.fromDegrees(0, -90, 0);

        var homeCameraView = {
            destination : initialPosition,
            orientation : {
                heading : initialOrientation.heading,
                pitch : initialOrientation.pitch,
                roll : initialOrientation.roll
            }
        };
        // Set the initial view
        // widget.scene.camera.setView(homeCameraView);
        viewer.scene.camera.setView(homeCameraView);
    }


    // START OF AUDIO STUFF
    // Connecting to the audio context and starting the analyser
    function radioTest() {
        window.removeEventListener("click", radioTest);
        audio.crossOrigin = 'anonymous'; // Useful to play hosted live stream with CORS enabled
        audio2.crossOrigin = 'anonymous'; // Useful to play hosted live stream with CORS enabled
        sourceAudio.connect(volume);
        // sourceAudio.connect(context.destination);
        volume.connect(context.destination);
        volume.gain.value = 0;
        audio2Source();
    }

    // Actual audio to be played and heard
    const playHandler = () => {
        // console.log("play");
        audio.play();
        change();
        //radioTower.style.display = "none";
        audio.removeEventListener('canplaythrough', playHandler);
    };
    // Muted audio that is being analyzed
    const play2Handler = () => {
        // console.log("play2");
        audio2.play();
        audio2.muted = false;
        newChannel = false;
        audio2.removeEventListener('canplaythrough', play2Handler);
        startUserMedia(audio2);
    };

    // Error handlers
    const errorHandler = e => {
        console.error('Error', e);
        audio.removeEventListener('error', errorHandler);
    };
    const error2Handler = e => {
        console.error('Error2', e);
        audio.removeEventListener('error2', error2Handler);
    };
    
    // Audio source will be called if a good audio2 is found
    function audioSource() {
        audio3.play();
        audioSrc = jdata[counter].src;
        audio.src = audioSrc;
        audio.addEventListener('canplaythrough', playHandler, false);
        audio.addEventListener('error', errorHandler);
    }

    // Changing the audio2 source
    function audio2Source() {
        audio2Src = jdata[counter2].src;
        audio2.src = audio2Src;
        audio2.addEventListener('canplaythrough', play2Handler, false);
        audio2.addEventListener('error2', error2Handler);
    }

    // Analyzer
    function startUserMedia(stream) {
        // console.log("startUserMedia!");
        var options = {
            onVoiceStart: function() {
                console.log('voice start');
            },
            onVoiceStop: function() {
                console.log('voice stop');
            },
            onUpdate: function(val) {
                // audio2.muted = false;
                // console.log('curr val:', val);
                // Calculating an average so we know there is voice activity
                if (vadValCounter < 200) {
                    vadValCounter ++;
                }
                else {
                    // console.log("100 values!")
                    vadValCounter = 1;
                    vadVal = 0;
                }
                vadVal += val;
                vadValAverage = vadVal / vadValCounter;

                // If we get a good audio we can associate the audio2 to the actual audio
                if(!introduction && vadValAverage > 0.2 && vadValCounter == 200){
                    introduction = true;
                    counter = counter2;
                    audioSource();
                    if(counter2 < jdata.length-1){
                        counter2++;
                        console.log(counter2);
                    }
                    else{
                        shuffle(jdata);
                        counter2 = 0;
                        console.log("reset");
                    }
                    audio2Source();
                }
                // Else we go to the next entry on the list
                else if(!introduction && !newChannel &&vadValAverage < 0.2 && vadValCounter == 200){
                    newChannel = true;
                    if(counter2 < jdata.length-1){
                        counter2++;
                        console.log(counter2);
                    }
                    else{
                        shuffle(jdata);
                        counter2 = 0;
                        console.log("reset");
                    }
                    audio2Source();
                }
                // audio2.muted = true;
            }
        };
        vad(context, stream, options, sourceAudio);
    }


}());

},{"../index.js":1,"../wiki.js":6}],6:[function(require,module,exports){
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



},{}]},{},[5])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9hbmFseXNlci1mcmVxdWVuY3ktYXZlcmFnZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9hdWRpby1mcmVxdWVuY3ktdG8taW5kZXgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY2xhbXAvaW5kZXguanMiLCJzb3VyY2UvYXBwLmpzIiwid2lraS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiJ3VzZSBzdHJpY3QnO1xudmFyIGFuYWx5c2VyRnJlcXVlbmN5ID0gcmVxdWlyZSgnYW5hbHlzZXItZnJlcXVlbmN5LWF2ZXJhZ2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihhdWRpb0NvbnRleHQsIHN0cmVhbSwgb3B0cywgc291cmNlQXVkaW8pIHtcblxuICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICB2YXIgZGVmYXVsdHMgPSB7XG4gICAgZmZ0U2l6ZTogMTAyNCxcbiAgICBidWZmZXJMZW46IDEwMjQsXG4gICAgc21vb3RoaW5nVGltZUNvbnN0YW50OiAwLjIsXG4gICAgbWluQ2FwdHVyZUZyZXE6IDg1LCAgICAgICAgIC8vIGluIEh6XG4gICAgbWF4Q2FwdHVyZUZyZXE6IDI1NSwgICAgICAgIC8vIGluIEh6XG4gICAgbm9pc2VDYXB0dXJlRHVyYXRpb246IDEwMDAsIC8vIGluIG1zXG4gICAgbWluTm9pc2VMZXZlbDogMC4zLCAgICAgICAgIC8vIGZyb20gMCB0byAxXG4gICAgbWF4Tm9pc2VMZXZlbDogMC43LCAgICAgICAgIC8vIGZyb20gMCB0byAxXG4gICAgYXZnTm9pc2VNdWx0aXBsaWVyOiAxLjIsXG4gICAgb25Wb2ljZVN0YXJ0OiBmdW5jdGlvbigpIHtcbiAgICB9LFxuICAgIG9uVm9pY2VTdG9wOiBmdW5jdGlvbigpIHtcbiAgICB9LFxuICAgIG9uVXBkYXRlOiBmdW5jdGlvbih2YWwpIHtcbiAgICB9XG4gIH07XG5cbiAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgZm9yICh2YXIga2V5IGluIGRlZmF1bHRzKSB7XG4gICAgb3B0aW9uc1trZXldID0gb3B0cy5oYXNPd25Qcm9wZXJ0eShrZXkpID8gb3B0c1trZXldIDogZGVmYXVsdHNba2V5XTtcbiAgfVxuXG4gIHZhciBiYXNlTGV2ZWwgPSAwO1xuICB2YXIgdm9pY2VTY2FsZSA9IDE7XG4gIHZhciBhY3Rpdml0eUNvdW50ZXIgPSAwO1xuICB2YXIgYWN0aXZpdHlDb3VudGVyTWluID0gMDtcbiAgdmFyIGFjdGl2aXR5Q291bnRlck1heCA9IDYwO1xuICB2YXIgYWN0aXZpdHlDb3VudGVyVGhyZXNoID0gNTtcblxuICB2YXIgZW52RnJlcVJhbmdlID0gW107XG4gIHZhciBpc05vaXNlQ2FwdHVyaW5nID0gdHJ1ZTtcbiAgdmFyIHByZXZWYWRTdGF0ZSA9IHVuZGVmaW5lZDtcbiAgdmFyIHZhZFN0YXRlID0gZmFsc2U7XG4gIHZhciBjYXB0dXJlVGltZW91dCA9IG51bGw7XG5cbiAgdmFyIHNvdXJjZSA9IHNvdXJjZUF1ZGlvO1xuICAvLyB2YXIgc291cmNlID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhRWxlbWVudFNvdXJjZShzdHJlYW0pO1xuICAvLyB2YXIgc291cmNlID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG4gIHZhciBhbmFseXNlciA9IGF1ZGlvQ29udGV4dC5jcmVhdGVBbmFseXNlcigpO1xuICBhbmFseXNlci5zbW9vdGhpbmdUaW1lQ29uc3RhbnQgPSBvcHRpb25zLnNtb290aGluZ1RpbWVDb25zdGFudDtcbiAgYW5hbHlzZXIuZmZ0U2l6ZSA9IG9wdGlvbnMuZmZ0U2l6ZTtcblxuICB2YXIgc2NyaXB0UHJvY2Vzc29yTm9kZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3Iob3B0aW9ucy5idWZmZXJMZW4sIDEsIDEpO1xuICBjb25uZWN0KCk7XG4gIHNjcmlwdFByb2Nlc3Nvck5vZGUub25hdWRpb3Byb2Nlc3MgPSBtb25pdG9yO1xuXG4gIGlmIChpc05vaXNlQ2FwdHVyaW5nKSB7XG4gICAgLy9jb25zb2xlLmxvZygnVkFEOiBzdGFydCBub2lzZSBjYXB0dXJpbmcnKTtcbiAgICBjYXB0dXJlVGltZW91dCA9IHNldFRpbWVvdXQoaW5pdCwgb3B0aW9ucy5ub2lzZUNhcHR1cmVEdXJhdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBpbml0KCkge1xuICAgIC8vY29uc29sZS5sb2coJ1ZBRDogc3RvcCBub2lzZSBjYXB0dXJpbmcnKTtcbiAgICBpc05vaXNlQ2FwdHVyaW5nID0gZmFsc2U7XG5cbiAgICBlbnZGcmVxUmFuZ2UgPSBlbnZGcmVxUmFuZ2UuZmlsdGVyKGZ1bmN0aW9uKHZhbCkge1xuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9KS5zb3J0KCk7XG4gICAgdmFyIGF2ZXJhZ2VFbnZGcmVxID0gZW52RnJlcVJhbmdlLmxlbmd0aCA/IGVudkZyZXFSYW5nZS5yZWR1Y2UoZnVuY3Rpb24gKHAsIGMpIHsgcmV0dXJuIE1hdGgubWluKHAsIGMpIH0sIDEpIDogKG9wdGlvbnMubWluTm9pc2VMZXZlbCB8fCAwLjEpO1xuXG4gICAgYmFzZUxldmVsID0gYXZlcmFnZUVudkZyZXEgKiBvcHRpb25zLmF2Z05vaXNlTXVsdGlwbGllcjtcbiAgICBpZiAob3B0aW9ucy5taW5Ob2lzZUxldmVsICYmIGJhc2VMZXZlbCA8IG9wdGlvbnMubWluTm9pc2VMZXZlbCkgYmFzZUxldmVsID0gb3B0aW9ucy5taW5Ob2lzZUxldmVsO1xuICAgIGlmIChvcHRpb25zLm1heE5vaXNlTGV2ZWwgJiYgYmFzZUxldmVsID4gb3B0aW9ucy5tYXhOb2lzZUxldmVsKSBiYXNlTGV2ZWwgPSBvcHRpb25zLm1heE5vaXNlTGV2ZWw7XG5cbiAgICB2b2ljZVNjYWxlID0gMSAtIGJhc2VMZXZlbDtcblxuICAgIC8vY29uc29sZS5sb2coJ1ZBRDogYmFzZSBsZXZlbDonLCBiYXNlTGV2ZWwpO1xuICB9XG5cbiAgZnVuY3Rpb24gY29ubmVjdCgpIHtcbiAgICBzb3VyY2UuY29ubmVjdChhbmFseXNlcik7XG4gICAgYW5hbHlzZXIuY29ubmVjdChzY3JpcHRQcm9jZXNzb3JOb2RlKTtcbiAgICBzY3JpcHRQcm9jZXNzb3JOb2RlLmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpc2Nvbm5lY3QoKSB7XG4gICAgc2NyaXB0UHJvY2Vzc29yTm9kZS5kaXNjb25uZWN0KCk7XG4gICAgYW5hbHlzZXIuZGlzY29ubmVjdCgpO1xuICAgIHNvdXJjZS5kaXNjb25uZWN0KCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95KCkge1xuICAgIGNhcHR1cmVUaW1lb3V0ICYmIGNsZWFyVGltZW91dChjYXB0dXJlVGltZW91dCk7XG4gICAgZGlzY29ubmVjdCgpO1xuICAgIHNjcmlwdFByb2Nlc3Nvck5vZGUub25hdWRpb3Byb2Nlc3MgPSBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gbW9uaXRvcigpIHtcbiAgICB2YXIgZnJlcXVlbmNpZXMgPSBuZXcgVWludDhBcnJheShhbmFseXNlci5mcmVxdWVuY3lCaW5Db3VudCk7XG4gICAgYW5hbHlzZXIuZ2V0Qnl0ZUZyZXF1ZW5jeURhdGEoZnJlcXVlbmNpZXMpO1xuXG4gICAgdmFyIGF2ZXJhZ2UgPSBhbmFseXNlckZyZXF1ZW5jeShhbmFseXNlciwgZnJlcXVlbmNpZXMsIG9wdGlvbnMubWluQ2FwdHVyZUZyZXEsIG9wdGlvbnMubWF4Q2FwdHVyZUZyZXEpO1xuICAgIGlmIChpc05vaXNlQ2FwdHVyaW5nKSB7XG4gICAgICBlbnZGcmVxUmFuZ2UucHVzaChhdmVyYWdlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoYXZlcmFnZSA+PSBiYXNlTGV2ZWwgJiYgYWN0aXZpdHlDb3VudGVyIDwgYWN0aXZpdHlDb3VudGVyTWF4KSB7XG4gICAgICBhY3Rpdml0eUNvdW50ZXIrKztcbiAgICB9IGVsc2UgaWYgKGF2ZXJhZ2UgPCBiYXNlTGV2ZWwgJiYgYWN0aXZpdHlDb3VudGVyID4gYWN0aXZpdHlDb3VudGVyTWluKSB7XG4gICAgICBhY3Rpdml0eUNvdW50ZXItLTtcbiAgICB9XG4gICAgdmFkU3RhdGUgPSBhY3Rpdml0eUNvdW50ZXIgPiBhY3Rpdml0eUNvdW50ZXJUaHJlc2g7XG5cbiAgICBpZiAocHJldlZhZFN0YXRlICE9PSB2YWRTdGF0ZSkge1xuICAgICAgdmFkU3RhdGUgPyBvblZvaWNlU3RhcnQoKSA6IG9uVm9pY2VTdG9wKCk7XG4gICAgICBwcmV2VmFkU3RhdGUgPSB2YWRTdGF0ZTtcbiAgICB9XG5cbiAgICBvcHRpb25zLm9uVXBkYXRlKE1hdGgubWF4KDAsIGF2ZXJhZ2UgLSBiYXNlTGV2ZWwpIC8gdm9pY2VTY2FsZSk7XG4gIH1cblxuICBmdW5jdGlvbiBvblZvaWNlU3RhcnQoKSB7XG4gICAgb3B0aW9ucy5vblZvaWNlU3RhcnQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uVm9pY2VTdG9wKCkge1xuICAgIG9wdGlvbnMub25Wb2ljZVN0b3AoKTtcbiAgfVxuXG4gIHJldHVybiB7Y29ubmVjdDogY29ubmVjdCwgZGlzY29ubmVjdDogZGlzY29ubmVjdCwgZGVzdHJveTogZGVzdHJveX07XG59OyIsInZhciBmcmVxdWVuY3lUb0luZGV4ID0gcmVxdWlyZSgnYXVkaW8tZnJlcXVlbmN5LXRvLWluZGV4JylcblxubW9kdWxlLmV4cG9ydHMgPSBhbmFseXNlckZyZXF1ZW5jeUF2ZXJhZ2UuYmluZChudWxsLCAyNTUpXG5tb2R1bGUuZXhwb3J0cy5mbG9hdERhdGEgPSBhbmFseXNlckZyZXF1ZW5jeUF2ZXJhZ2UuYmluZChudWxsLCAxKVxuXG5mdW5jdGlvbiBhbmFseXNlckZyZXF1ZW5jeUF2ZXJhZ2UgKGRpdiwgYW5hbHlzZXIsIGZyZXF1ZW5jaWVzLCBtaW5IeiwgbWF4SHopIHtcbiAgdmFyIHNhbXBsZVJhdGUgPSBhbmFseXNlci5jb250ZXh0LnNhbXBsZVJhdGVcbiAgdmFyIGJpbkNvdW50ID0gYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnRcbiAgdmFyIHN0YXJ0ID0gZnJlcXVlbmN5VG9JbmRleChtaW5Ieiwgc2FtcGxlUmF0ZSwgYmluQ291bnQpXG4gIHZhciBlbmQgPSBmcmVxdWVuY3lUb0luZGV4KG1heEh6LCBzYW1wbGVSYXRlLCBiaW5Db3VudClcbiAgdmFyIGNvdW50ID0gZW5kIC0gc3RhcnRcbiAgdmFyIHN1bSA9IDBcbiAgZm9yICg7IHN0YXJ0IDwgZW5kOyBzdGFydCsrKSB7XG4gICAgc3VtICs9IGZyZXF1ZW5jaWVzW3N0YXJ0XSAvIGRpdlxuICB9XG4gIHJldHVybiBjb3VudCA9PT0gMCA/IDAgOiAoc3VtIC8gY291bnQpXG59XG4iLCJ2YXIgY2xhbXAgPSByZXF1aXJlKCdjbGFtcCcpXG5cbm1vZHVsZS5leHBvcnRzID0gZnJlcXVlbmN5VG9JbmRleFxuZnVuY3Rpb24gZnJlcXVlbmN5VG9JbmRleCAoZnJlcXVlbmN5LCBzYW1wbGVSYXRlLCBmcmVxdWVuY3lCaW5Db3VudCkge1xuICB2YXIgbnlxdWlzdCA9IHNhbXBsZVJhdGUgLyAyXG4gIHZhciBpbmRleCA9IE1hdGgucm91bmQoZnJlcXVlbmN5IC8gbnlxdWlzdCAqIGZyZXF1ZW5jeUJpbkNvdW50KVxuICByZXR1cm4gY2xhbXAoaW5kZXgsIDAsIGZyZXF1ZW5jeUJpbkNvdW50KVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBjbGFtcFxuXG5mdW5jdGlvbiBjbGFtcCh2YWx1ZSwgbWluLCBtYXgpIHtcbiAgcmV0dXJuIG1pbiA8IG1heFxuICAgID8gKHZhbHVlIDwgbWluID8gbWluIDogdmFsdWUgPiBtYXggPyBtYXggOiB2YWx1ZSlcbiAgICA6ICh2YWx1ZSA8IG1heCA/IG1heCA6IHZhbHVlID4gbWluID8gbWluIDogdmFsdWUpXG59XG4iLCIoZnVuY3Rpb24gKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIC8vIERlY2xhcmluZyB2YXJpYWJsZXNcbiAgICB3aW5kb3cuQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuICAgIHZhciB2YWQgPSByZXF1aXJlKCcuLi9pbmRleC5qcycpO1xuICAgIHZhciB3aWtpID0gcmVxdWlyZSgnLi4vd2lraS5qcycpO1xuICAgIHZhciBpbnRyb2R1Y3Rpb24gPSBmYWxzZTtcbiAgICB2YXIgbmV3Q2hhbm5lbCA9IGZhbHNlO1xuICAgIHZhciBhdWRpb1NyYztcbiAgICB2YXIgYXVkaW8yU3JjO1xuICAgIHZhciBqZGF0YSA9IFtdO1xuICAgIHZhciBjb3VudGVyID0gMDtcbiAgICB2YXIgY291bnRlcjIgPSAwO1xuICAgIHZhciB2YWRWYWw7XG4gICAgdmFyIHZhZFZhbENvdW50ZXI7XG4gICAgdmFyIHZhZFZhbEF2ZXJhZ2U7XG4gICAgdmFyIHR4dDtcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgLy8gdmFyIGNvbnRleHQgPSBuZXcgKHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCkoKTtcbiAgICB2YXIgYXVkaW8gPSBuZXcgQXVkaW8oKTtcbiAgICB2YXIgYXVkaW8yID0gbmV3IEF1ZGlvKCk7XG4gICAgdmFyIGF1ZGlvMyA9IG5ldyBBdWRpbygpO1xuICAgIGF1ZGlvMy5zcmMgPSBcIi4vc291cmNlL0F1ZGlvL3JhZGlvLm1wM1wiO1xuICAgIGF1ZGlvMy52b2x1bWUgPSAwLjU7XG4gICAgdmFyIHNvdXJjZUF1ZGlvID0gY29udGV4dC5jcmVhdGVNZWRpYUVsZW1lbnRTb3VyY2UoYXVkaW8yKTtcbiAgICB2YXIgdm9sdW1lID0gY29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgY29uc3QgaW50cm9EaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImludHJvXCIpO1xuICAgIGNvbnN0IGNlc2l1bUNvbnRhaW5lckRpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiY2VzaXVtQ29udGFpbmVyXCIpO1xuICAgIGNvbnN0IGJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdteS1idXR0b24nKTsgLy8gYWRkIGlkPVwibXktYnV0dG9uXCIgaW50byBodG1sXG4gICAgY29uc3Qgd2lraUluZm9EaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2lraUluZm8nKTtcbiAgICBjb25zdCByYWRpb1Rvd2VyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JhZGlvVG93ZXInKTtcbiAgICBjb25zdCBsb2FkaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYWRpbmcnKTtcblxuICAgIC8vIEhpZGUgZWxlbWVudHMgYmVmb3JlIGdldHRpbmcgdGhlIGpzb24gZmlsZVxuICAgIGludHJvRGl2LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICBjZXNpdW1Db250YWluZXJEaXYuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIHJhZGlvVG93ZXIuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIHdpa2lJbmZvRGl2LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICBsb2FkaW5nLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuICAgIC8vIEdldHRpbmcgdGhlIEpTT04gZmlsZSBhbmQgc2h1ZmZsaW5nIHRoZSBhcnJheSBmb3IgcmFuZG9tIHJlc3VsdHNcbiAgICBmZXRjaChcIi4vU291cmNlL3JhZGlvcy5qc29uXCIpXG4gICAgLnRoZW4oZnVuY3Rpb24ocmVzcCkge1xuICAgICAgICByZXR1cm4gcmVzcC5qc29uKCk7XG4gICAgfSlcbiAgICAudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIGpkYXRhID0gZGF0YTtcbiAgICAgICAgc2h1ZmZsZShqZGF0YSk7XG4gICAgICAgIGdvdERhdGEoKTtcbiAgICB9KTtcblxuICAgIC8vIEluaXRpYWxpemluZyB0aGUgbWFwIGFuZCBzaG93aW5nIHRoZSBzdGFydCBidXR0b24gYWZ0ZXIgZ2V0dGluZyB0aGUgZGF0YVxuICAgIGZ1bmN0aW9uIGdvdERhdGEoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGpkYXRhKTtcbiAgICAgICAgbWFwSW5pdFBvcygpO1xuICAgICAgICBiaWxsYm9hcmQoKTtcbiAgICAgICAgaW50cm9EaXYuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYnV0dG9uQ2xpY2spO1xuICAgIH1cblxuICAgIC8vIFN0YXJ0aW5nIHRoZSBhdWRpbyBhZnRlciBjbGlja2luZyBzdGFydFxuICAgIGZ1bmN0aW9uIGJ1dHRvbkNsaWNrKCkge1xuICAgICAgICByYWRpb1Rlc3QoKTtcbiAgICAgICAgY2VzaXVtQ29udGFpbmVyRGl2LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgICAgIGJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGxvYWRpbmcuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgZGlzYWJsZUlucHV0cygpO1xuICAgIH1cblxuICAgIC8vIEZ1bmN0aW9uIHRoYXQgYWRkIGEgcmVkIGRvdCBhdCB0YXJnZXRzIGxvY2F0aW9uXG4gICAgZnVuY3Rpb24gYmlsbGJvYXJkKCkge1xuICAgICAgICB2aWV3ZXIuZW50aXRpZXMuYWRkKHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBuZXcgQ2VzaXVtLkNhcnRlc2lhbjMuZnJvbURlZ3JlZXMoamRhdGFbY291bnRlcl0ubG9jWzBdLCBqZGF0YVtjb3VudGVyXS5sb2NbMV0sIDEpLFxuICAgICAgICAgICAgYmlsbGJvYXJkOiB7XG4gICAgICAgICAgICAgICAgaW1hZ2U6IFwiLi9Tb3VyY2UvSW1hZ2VzL2RvdC5wbmdcIixcbiAgICAgICAgICAgICAgICBzY2FsZTogMC4wMVxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICAvLyBGdW5jdGlvbiB0aGF0IGZsaWVzIHRvIGEgbmV3IGxvY2F0aW9uIGV2ZXJ5IDE1IHNlY29uZHNcbiAgICBmdW5jdGlvbiBjaGFuZ2UoKSB7XG4gICAgICAgIGF1ZGlvMy5wYXVzZSgpO1xuICAgICAgICBhdWRpbzMuY3VycmVudFRpbWUgPSAwO1xuICAgICAgICBpbnRyb0Rpdi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIHJhZGlvVG93ZXIuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICBjb25zb2xlLmxvZyhcImNoYW5nZTogY291bnRlciA9IFwiK2NvdW50ZXIpO1xuICAgICAgICB3aWtpKGpkYXRhW2NvdW50ZXJdLmNpdHksIGZ1bmN0aW9uKHJlc3BvbnNlKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIHdpa2lJbmZvRGl2LmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgICAgICB0eHQgPSByZXNwb25zZTtcbiAgICAgICAgICAgIC8vICQoXCIjd2lraUluZm9cIikuYXBwZW5kKHJlc3BvbnNlKTsvLyBhcHBlbmRcbiAgICAgICAgICAgIC8vICQoXCIjd2lraUluZm9cIikuYXBwZW5kKFwiPGRpdj5cIityZXNwb25zZStcIjwvZGl2PlwiKTsvLyBhcHBlbmRcbiAgICAgICAgICAgIHdpa2lJbmZvRGl2LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gICAgICAgICAgICB0eXBlV3JpdGVyKCk7XG4gICAgICAgIH0pO1xuICAgICAgICB2aWV3ZXIuc2NlbmUuY2FtZXJhLmZseVRvKHtcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uOiBuZXcgQ2VzaXVtLkNhcnRlc2lhbjMuZnJvbURlZ3JlZXMoamRhdGFbY291bnRlcl0ubG9jWzBdLCBqZGF0YVtjb3VudGVyXS5sb2NbMV0sIGpkYXRhW2NvdW50ZXJdLmxvY1syXSksXG4gICAgICAgICAgICBkdXJhdGlvbjogMTUsXG4gICAgICAgICAgICBjb21wbGV0ZTogZmx5RW5kXG4gICAgICAgIH0pO1xuICAgICAgICB2aWV3ZXIuZW50aXRpZXMuYWRkKHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBuZXcgQ2VzaXVtLkNhcnRlc2lhbjMuZnJvbURlZ3JlZXMoamRhdGFbY291bnRlcl0ubG9jWzBdLCBqZGF0YVtjb3VudGVyXS5sb2NbMV0sIDEpLFxuICAgICAgICAgICAgYmlsbGJvYXJkOiB7XG4gICAgICAgICAgICAgICAgaW1hZ2U6IFwiLi9Tb3VyY2UvSW1hZ2VzL2RvdC5wbmdcIixcbiAgICAgICAgICAgICAgICBzY2FsZTogMC4wMVxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IG15VGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpbnRyb2R1Y3Rpb24gPSBmYWxzZTtcbiAgICAgICAgICAgIC8vIGNoYW5nZSgpO1xuICAgICAgICB9LCAzMDAwMCk7XG4gICAgfVxuXG4gICAgLy8gU2h1ZmZsZSBhbiBhcnJheVxuICAgIGZ1bmN0aW9uIHNodWZmbGUoYXJyYXkpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRJbmRleCA9IGFycmF5Lmxlbmd0aCwgdGVtcG9yYXJ5VmFsdWUsIHJhbmRvbUluZGV4O1xuICAgICAgXG4gICAgICAgIC8vIFdoaWxlIHRoZXJlIHJlbWFpbiBlbGVtZW50cyB0byBzaHVmZmxlLi4uXG4gICAgICAgIHdoaWxlICgwICE9PSBjdXJyZW50SW5kZXgpIHtcbiAgICAgIFxuICAgICAgICAgIC8vIFBpY2sgYSByZW1haW5pbmcgZWxlbWVudC4uLlxuICAgICAgICAgIHJhbmRvbUluZGV4ID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY3VycmVudEluZGV4KTtcbiAgICAgICAgICBjdXJyZW50SW5kZXggLT0gMTtcbiAgICAgIFxuICAgICAgICAgIC8vIEFuZCBzd2FwIGl0IHdpdGggdGhlIGN1cnJlbnQgZWxlbWVudC5cbiAgICAgICAgICB0ZW1wb3JhcnlWYWx1ZSA9IGFycmF5W2N1cnJlbnRJbmRleF07XG4gICAgICAgICAgYXJyYXlbY3VycmVudEluZGV4XSA9IGFycmF5W3JhbmRvbUluZGV4XTtcbiAgICAgICAgICBhcnJheVtyYW5kb21JbmRleF0gPSB0ZW1wb3JhcnlWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgXG4gICAgICAgIHJldHVybiBhcnJheTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0eXBlV3JpdGVyKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcInR5cGluZ1wiKVxuICAgICAgICBpZiAoaSA8IHR4dC5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIHdpa2lJbmZvRGl2LmlubmVySFRNTCArPSB0eHQuY2hhckF0KGkpO1xuICAgICAgICAgICAgaWYodHh0W2ldID09IFwiPFwiICYmIHR4dFtpKzFdICE9IFwiL1wiKXtcbiAgICAgICAgICAgICAgICAkKFwiI3dpa2lJbmZvXCIpLmFwcGVuZCh0eHRbaV0rdHh0W2krMV0rdHh0W2krMl0pO1xuICAgICAgICAgICAgICAgIGkgKz0gMztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYodHh0W2ldID09IFwiPFwiICYmIHR4dFtpKzFdID09IFwiL1wiKXtcbiAgICAgICAgICAgICAgICAkKFwiI3dpa2lJbmZvXCIpLmFwcGVuZCh0eHRbaV0rdHh0W2krMV0rdHh0W2krMl0rdHh0W2krM10pO1xuICAgICAgICAgICAgICAgIGkgKz0gNDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICQoXCIjd2lraUluZm9cIikuYXBwZW5kKHR4dFtpXSk7XG4gICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2V0VGltZW91dCh0eXBlV3JpdGVyLCA1KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChpID0gdHh0Lmxlbmd0aCkge1xuICAgICAgICAgICAgaSA9IDA7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIC8vIFNUQVJUIE9GIE1BUCBTVFVGRlxuICAgIC8vIFRPRE86IEFkZCB5b3VyIGlvbiBhY2Nlc3MgdG9rZW4gZnJvbSBjZXNpdW0uY29tL2lvbi9cbiAgICBDZXNpdW0uSW9uLmRlZmF1bHRBY2Nlc3NUb2tlbiA9ICdleUpoYkdjaU9pSklVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcWRHa2lPaUpoTkRrMU5XUXlZaTFrTldFNUxUUmtaR0l0T0Rrd1lpMHdZekpqT1RJeVkyTTVabVFpTENKcFpDSTZNemcxTURBc0ltbGhkQ0k2TVRZd05qUXdOVEl3TTMwLklfNUh3dkhILVZrZUVKLWllNWpWaFV2WFdZYmZJZ29ya3RWOVRBVmM4TFUnO1xuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyBDcmVhdGluZyB0aGUgVmlld2VyXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyB2YXIgb3NtID0gbmV3IENlc2l1bS5jcmVhdGVPcGVuU3RyZWV0TWFwSW1hZ2VyeVByb3ZpZGVyKHtcbiAgICAvLyAgICAgdXJsIDogJ2h0dHBzOi8vYS50aWxlLm9wZW5zdHJlZXRtYXAub3JnLydcbiAgICAvLyB9KTtcblxuICAgIHZhciB2aWV3ZXIgPSBuZXcgQ2VzaXVtLlZpZXdlcignY2VzaXVtQ29udGFpbmVyJywge1xuICAgICAgICBzY2VuZTNET25seTogdHJ1ZSxcbiAgICAgICAgc2VsZWN0aW9uSW5kaWNhdG9yOiBmYWxzZSxcbiAgICAgICAgYmFzZUxheWVyUGlja2VyOiB0cnVlLFxuICAgICAgICBob21lQnV0dG9uOiBmYWxzZSxcbiAgICAgICAgdGltZWxpbmU6IGZhbHNlLFxuICAgICAgICBnZW9jb2RlcjogdHJ1ZSxcbiAgICAgICAgbmF2aWdhdGlvbkhlbHBCdXR0b246IGZhbHNlLFxuICAgICAgICBhbmltYXRpb246IGZhbHNlLFxuICAgICAgICBjcmVkaXRDb250YWluZXI6IFwiY3JlZGl0Q29udGFpbmVyXCIsXG4gICAgICAgIGZ1bGxzY3JlZW5CdXR0b246IGZhbHNlLFxuICAgICAgICBzaGFkb3dzOiB0cnVlXG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBmbHlFbmQoKSB7XG4gICAgICAgIHJhZGlvVG93ZXIuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgLy8gcmFkaW9Ub3dlci5zcmMgPSBcIi9zb3VyY2UvSW1hZ2VzL3JhZGlvR2lmLmdpZlwiO1xuICAgICAgICByYWRpb1Rvd2VyLnNyYyA9IHJhZGlvVG93ZXIuc3JjLnJlcGxhY2UoL1xcPy4qJC8sXCJcIikrXCI/eD1cIitNYXRoLnJhbmRvbSgpO1xuICAgICAgICBkaXNhYmxlSW5wdXRzKCk7XG4gICAgICAgIHZpZXdlci5zY2VuZS5jYW1lcmEuZmx5VG8oe1xuICAgICAgICAgICAgZGVzdGluYXRpb246IG5ldyBDZXNpdW0uQ2FydGVzaWFuMy5mcm9tRGVncmVlcyhqZGF0YVtjb3VudGVyXS5sb2NbMF0sIGpkYXRhW2NvdW50ZXJdLmxvY1sxXSwgamRhdGFbY291bnRlcl0ubG9jWzJdLTEwMDApLFxuICAgICAgICAgICAgZHVyYXRpb246IDIwXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpc2FibGVJbnB1dHMoKSB7XG4gICAgICAgIC8vIGZvciBzb21lIHJlYXNvbiB0aGUgZmx5VG8gZnVuY3Rpb24gZW5hYmxlcyBpbnB1dHMgYXQgdGhlIGVuZCBhZnRlciB0aGUgY2FsbCBvZiB0aGlzIGZ1bmN0aW9uXG4gICAgICAgIC8vIERpc2FibGluZyBpdCBvbmUgMW1zIGFmdGVyIHNlZW1zIHRvIGZpeCB0aGlzIGlzc3Vlc1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB2aWV3ZXIuc2NlbmUuc2NyZWVuU3BhY2VDYW1lcmFDb250cm9sbGVyLmVuYWJsZUlucHV0cyA9IGZhbHNlO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJpbnB1dHMgZGlzYWJsZWRcIik7XG4gICAgICAgIH0sMSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYXBJbml0UG9zKCkge1xuICAgICAgICAvLyAvLyAvLyBDcmVhdGUgYW4gaW5pdGlhbCBjYW1lcmEgdmlld1xuICAgICAgICB2YXIgaW5pdGlhbFBvc2l0aW9uID0gbmV3IENlc2l1bS5DYXJ0ZXNpYW4zLmZyb21EZWdyZWVzKGpkYXRhWzBdLmxvY1swXSwgamRhdGFbMF0ubG9jWzFdLCAxMDAwMDAwMCk7XG4gICAgICAgIHZhciBpbml0aWFsT3JpZW50YXRpb24gPSBuZXcgQ2VzaXVtLkhlYWRpbmdQaXRjaFJvbGwuZnJvbURlZ3JlZXMoMCwgLTkwLCAwKTtcblxuICAgICAgICB2YXIgaG9tZUNhbWVyYVZpZXcgPSB7XG4gICAgICAgICAgICBkZXN0aW5hdGlvbiA6IGluaXRpYWxQb3NpdGlvbixcbiAgICAgICAgICAgIG9yaWVudGF0aW9uIDoge1xuICAgICAgICAgICAgICAgIGhlYWRpbmcgOiBpbml0aWFsT3JpZW50YXRpb24uaGVhZGluZyxcbiAgICAgICAgICAgICAgICBwaXRjaCA6IGluaXRpYWxPcmllbnRhdGlvbi5waXRjaCxcbiAgICAgICAgICAgICAgICByb2xsIDogaW5pdGlhbE9yaWVudGF0aW9uLnJvbGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgLy8gU2V0IHRoZSBpbml0aWFsIHZpZXdcbiAgICAgICAgLy8gd2lkZ2V0LnNjZW5lLmNhbWVyYS5zZXRWaWV3KGhvbWVDYW1lcmFWaWV3KTtcbiAgICAgICAgdmlld2VyLnNjZW5lLmNhbWVyYS5zZXRWaWV3KGhvbWVDYW1lcmFWaWV3KTtcbiAgICB9XG5cblxuICAgIC8vIFNUQVJUIE9GIEFVRElPIFNUVUZGXG4gICAgLy8gQ29ubmVjdGluZyB0byB0aGUgYXVkaW8gY29udGV4dCBhbmQgc3RhcnRpbmcgdGhlIGFuYWx5c2VyXG4gICAgZnVuY3Rpb24gcmFkaW9UZXN0KCkge1xuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHJhZGlvVGVzdCk7XG4gICAgICAgIGF1ZGlvLmNyb3NzT3JpZ2luID0gJ2Fub255bW91cyc7IC8vIFVzZWZ1bCB0byBwbGF5IGhvc3RlZCBsaXZlIHN0cmVhbSB3aXRoIENPUlMgZW5hYmxlZFxuICAgICAgICBhdWRpbzIuY3Jvc3NPcmlnaW4gPSAnYW5vbnltb3VzJzsgLy8gVXNlZnVsIHRvIHBsYXkgaG9zdGVkIGxpdmUgc3RyZWFtIHdpdGggQ09SUyBlbmFibGVkXG4gICAgICAgIHNvdXJjZUF1ZGlvLmNvbm5lY3Qodm9sdW1lKTtcbiAgICAgICAgLy8gc291cmNlQXVkaW8uY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgdm9sdW1lLmNvbm5lY3QoY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICAgIHZvbHVtZS5nYWluLnZhbHVlID0gMDtcbiAgICAgICAgYXVkaW8yU291cmNlKCk7XG4gICAgfVxuXG4gICAgLy8gQWN0dWFsIGF1ZGlvIHRvIGJlIHBsYXllZCBhbmQgaGVhcmRcbiAgICBjb25zdCBwbGF5SGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJwbGF5XCIpO1xuICAgICAgICBhdWRpby5wbGF5KCk7XG4gICAgICAgIGNoYW5nZSgpO1xuICAgICAgICAvL3JhZGlvVG93ZXIuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgICAgICBhdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCdjYW5wbGF5dGhyb3VnaCcsIHBsYXlIYW5kbGVyKTtcbiAgICB9O1xuICAgIC8vIE11dGVkIGF1ZGlvIHRoYXQgaXMgYmVpbmcgYW5hbHl6ZWRcbiAgICBjb25zdCBwbGF5MkhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwicGxheTJcIik7XG4gICAgICAgIGF1ZGlvMi5wbGF5KCk7XG4gICAgICAgIGF1ZGlvMi5tdXRlZCA9IGZhbHNlO1xuICAgICAgICBuZXdDaGFubmVsID0gZmFsc2U7XG4gICAgICAgIGF1ZGlvMi5yZW1vdmVFdmVudExpc3RlbmVyKCdjYW5wbGF5dGhyb3VnaCcsIHBsYXkySGFuZGxlcik7XG4gICAgICAgIHN0YXJ0VXNlck1lZGlhKGF1ZGlvMik7XG4gICAgfTtcblxuICAgIC8vIEVycm9yIGhhbmRsZXJzXG4gICAgY29uc3QgZXJyb3JIYW5kbGVyID0gZSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yJywgZSk7XG4gICAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZXJyb3JIYW5kbGVyKTtcbiAgICB9O1xuICAgIGNvbnN0IGVycm9yMkhhbmRsZXIgPSBlID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IyJywgZSk7XG4gICAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yMicsIGVycm9yMkhhbmRsZXIpO1xuICAgIH07XG4gICAgXG4gICAgLy8gQXVkaW8gc291cmNlIHdpbGwgYmUgY2FsbGVkIGlmIGEgZ29vZCBhdWRpbzIgaXMgZm91bmRcbiAgICBmdW5jdGlvbiBhdWRpb1NvdXJjZSgpIHtcbiAgICAgICAgYXVkaW8zLnBsYXkoKTtcbiAgICAgICAgYXVkaW9TcmMgPSBqZGF0YVtjb3VudGVyXS5zcmM7XG4gICAgICAgIGF1ZGlvLnNyYyA9IGF1ZGlvU3JjO1xuICAgICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdjYW5wbGF5dGhyb3VnaCcsIHBsYXlIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZXJyb3JIYW5kbGVyKTtcbiAgICB9XG5cbiAgICAvLyBDaGFuZ2luZyB0aGUgYXVkaW8yIHNvdXJjZVxuICAgIGZ1bmN0aW9uIGF1ZGlvMlNvdXJjZSgpIHtcbiAgICAgICAgYXVkaW8yU3JjID0gamRhdGFbY291bnRlcjJdLnNyYztcbiAgICAgICAgYXVkaW8yLnNyYyA9IGF1ZGlvMlNyYztcbiAgICAgICAgYXVkaW8yLmFkZEV2ZW50TGlzdGVuZXIoJ2NhbnBsYXl0aHJvdWdoJywgcGxheTJIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIGF1ZGlvMi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcjInLCBlcnJvcjJIYW5kbGVyKTtcbiAgICB9XG5cbiAgICAvLyBBbmFseXplclxuICAgIGZ1bmN0aW9uIHN0YXJ0VXNlck1lZGlhKHN0cmVhbSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInN0YXJ0VXNlck1lZGlhIVwiKTtcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBvblZvaWNlU3RhcnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd2b2ljZSBzdGFydCcpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9uVm9pY2VTdG9wOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndm9pY2Ugc3RvcCcpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9uVXBkYXRlOiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAvLyBhdWRpbzIubXV0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnY3VyciB2YWw6JywgdmFsKTtcbiAgICAgICAgICAgICAgICAvLyBDYWxjdWxhdGluZyBhbiBhdmVyYWdlIHNvIHdlIGtub3cgdGhlcmUgaXMgdm9pY2UgYWN0aXZpdHlcbiAgICAgICAgICAgICAgICBpZiAodmFkVmFsQ291bnRlciA8IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICB2YWRWYWxDb3VudGVyICsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCIxMDAgdmFsdWVzIVwiKVxuICAgICAgICAgICAgICAgICAgICB2YWRWYWxDb3VudGVyID0gMTtcbiAgICAgICAgICAgICAgICAgICAgdmFkVmFsID0gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFkVmFsICs9IHZhbDtcbiAgICAgICAgICAgICAgICB2YWRWYWxBdmVyYWdlID0gdmFkVmFsIC8gdmFkVmFsQ291bnRlcjtcblxuICAgICAgICAgICAgICAgIC8vIElmIHdlIGdldCBhIGdvb2QgYXVkaW8gd2UgY2FuIGFzc29jaWF0ZSB0aGUgYXVkaW8yIHRvIHRoZSBhY3R1YWwgYXVkaW9cbiAgICAgICAgICAgICAgICBpZighaW50cm9kdWN0aW9uICYmIHZhZFZhbEF2ZXJhZ2UgPiAwLjIgJiYgdmFkVmFsQ291bnRlciA9PSAyMDApe1xuICAgICAgICAgICAgICAgICAgICBpbnRyb2R1Y3Rpb24gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb3VudGVyID0gY291bnRlcjI7XG4gICAgICAgICAgICAgICAgICAgIGF1ZGlvU291cmNlKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmKGNvdW50ZXIyIDwgamRhdGEubGVuZ3RoLTEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgY291bnRlcjIrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNvdW50ZXIyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgc2h1ZmZsZShqZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudGVyMiA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlc2V0XCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGF1ZGlvMlNvdXJjZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBFbHNlIHdlIGdvIHRvIHRoZSBuZXh0IGVudHJ5IG9uIHRoZSBsaXN0XG4gICAgICAgICAgICAgICAgZWxzZSBpZighaW50cm9kdWN0aW9uICYmICFuZXdDaGFubmVsICYmdmFkVmFsQXZlcmFnZSA8IDAuMiAmJiB2YWRWYWxDb3VudGVyID09IDIwMCl7XG4gICAgICAgICAgICAgICAgICAgIG5ld0NoYW5uZWwgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBpZihjb3VudGVyMiA8IGpkYXRhLmxlbmd0aC0xKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50ZXIyKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjb3VudGVyMik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNodWZmbGUoamRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY291bnRlcjIgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJyZXNldFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhdWRpbzJTb3VyY2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gYXVkaW8yLm11dGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdmFkKGNvbnRleHQsIHN0cmVhbSwgb3B0aW9ucywgc291cmNlQXVkaW8pO1xuICAgIH1cblxuXG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihpbnB1dERhdGEsIGNhbGxiYWNrKSB7XG5cbiAgICAvKiBQUklOQ0lQTEVTICMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjICovXG4gICAgLy8gMS4gQVBJJ1MgVVJMOlxuICAgIC8vIDFhLlBhcnRzIG9mIHRoZSB1cmw6XG4gICAgd2QgPSBcImh0dHBzOi8vd3d3Lndpa2lkYXRhLm9yZy93L2FwaS5waHA/XCI7XG4gICAgd3AgPSBcImh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93L2FwaS5waHA/XCI7IC8vIGxpc3Qgb2YgaXNvLWNvZGUgPSA/IC0tLS0tLS0tLS0tLS0tLS08XG4gICAgYXcgPSBcImFjdGlvbj13YmdldGVudGl0aWVzXCIgOyAvLyByYXRoZXIgd2Rwb2ludFxuICAgIGFxID0gXCJhY3Rpb249cXVlcnlcIiA7IC8vID9yYXRoZXIgd3BwYWdlXG4gICAgdHMgPSBcIiZzaXRlcz1lbndpa2lcIiA7IC8vIHdkIG9ubHkmcmVxdWlyZWQuIC8vIGxpc3Qgb2Ygd2lraS1jb2RlID0gPyAtLS0tLS0tLS0tLS0tLTxcbiAgICB0ID0gXCImdGl0bGVzPVwiIC8vIHRhcmdldCwgd2R8d3BcbiAgICBpID0gXCJNb250cmVhbFwiOyAvL2l0ZW0sIHdkfHdwXG4gICAgLy8gaV9odCA9IFwi77yK772e57Gz5a2X6Y21772eXCIgOyAvLyB3ZHBvaW50fHdwcGFnZSAtLSArZmV3IGRhdGFcbiAgICAvLyBpX2hzID0gXCLvvIrvvZ7nsbPlrZfplK7vvZ5cIiA7IC8vIHdkcG9pbnQ6IG1pc3Npbmc7IHdwcGFnZTogcmVkaXJlY3QgKGNvbmZpcm1lZClcbiAgICAvLyBpX2h0ID0gXCLkuK3lnItcIiA7IC8vIHdkcG9pbnR8d3BwYWdlIC0tICttYW55IGRhdGFcbiAgICAvLyBpX2hzID0gXCLkuK3lm71cIiA7IC8vIHdkcG9pbnQ6IG1pc3Npbmc7IHdwcGFnZTogcmVkaXJlY3QgKGlkZW0pXG4gICAgbCAgPSBcIiZsYW5ndWFnZXM9emh8emgtY2xhc3NpY2FsfHpoLWNufHpoLWhhbnN8emgtaGFudHx6aC1oa3x6aC1taW4tbmFufHpoLW1vfHpoLW15fHpoLXNnfHpoLXR3fGZyXCIgOyAvLyB3ZHBvaW50IG9ubHlcbiAgICBwcyA9IFwiJnByb3BzPXNpdGVsaW5rc3xsYWJlbHN8YWxpYXNlc3xkZXNjcmlwdGlvbnNcIiA7IC8vIHdkcG9pbnQgb25seVxuICAgIC8vc2l0ZWxpbmtzOiBhbGwgaW50ZXJ3aWtpc1xuICAgIC8vbGFiZWxzOiB0aXRsZSB3aXRob3V0IF8odGFnKSwgZm9yIGwgKGxhbmd1YWdlcykgb25seVxuICAgIC8vYWxpYXNlczogbGFiZWwgb2YgcmVkaXJlY3QgcGFnZVxuICAgIHAgPSBcIiZwcm9wPWV4dHJhY3RzJmV4aW50cm8mZXhwbGFpbnRleHQmZXhzZW50ZW5jZXM9MTBcIiA7IC8vIHdwcGFnZSBvbmx5XG4gICAgciA9IFwiJnJlZGlyZWN0cyZjb252ZXJ0dGl0bGVzXCIgOyAvLyB3cHBhZ2Ugb25seVxuICAgIGMgPSBcIiZjYWxsYmFjaz0/XCIgOy8vIHdkfHdwXG4gICAgZiA9IFwiJmZvcm1hdD1qc29uXCIgOy8vIHdkfHdwXG5cbiAgICBsZXQgaW5wdXQgPSBpbnB1dERhdGE7XG4gICAgbGV0IGZpbmFsUiA9IFwiXCI7XG5cbiAgICAvLzFiLiBDb21wb3NlIHlvdXIgdXJsOlxuICAgIHVybHdkID0gd2QrYXcrdHMrdCtpK2wrcHMgICAgK2MrZjsgLy8gdHlwaWNhbCB3ZCBxdWVyeVxuICAgIHVybHdwICAgPSB3cCthcSAgICt0K2kgICAgICtwK3IrYytmOyAvLyB0eXBpY2FsIHdwIHF1ZXJ5XG4gICAgLy8gRXhhbXBsZXMgcHJpbnQgaW4gY29uc29sZTpcbiAgICAvLyBjb25zb2xlLmxvZyhcIjEuIFdEOiBcIit1cmx3ZCk7XG4gICAgLy8gY29uc29sZS5sb2coXCIyLiBXUDogXCIrdXJsd3ApO1xuXG4gICAgLyogdHJhbnNsYXRlICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG4gICAgLy8gdmFyIHdpa2lkYXRhX3RyYW5zbGF0ZSA9IGZ1bmN0aW9uIChpdGVtLGlzb2xhbmcpIHtcbiAgICAvLyAgICAgdmFyIHVybCA9IHdkK2F3K3RzK3QraXRlbStsK3BzICAgICtjK2YsIC8vIHR5cGljYWwgd2QgcXVlcnlcbiAgICAvLyAgICAgICAgIGlzbyA9IGlzb2xhbmcrXCJ3aWtpXCIsXG4gICAgLy8gICAgICAgICB0cmFkPVwiXCI7XG4gICAgLy8gICAgIGNvbnNvbGUubG9nKHVybCk7XG4gICAgLy8gICAgICQuZ2V0SlNPTih1cmwsIGZ1bmN0aW9uIChqc29uKSB7XG4gICAgLy8gICAgICAgICB0cmFkID0gIGpzb24uZW50aXRpZXNbIE9iamVjdC5rZXlzKGpzb24uZW50aXRpZXMpWzBdIF0uc2l0ZWxpbmtzW2lzb10udGl0bGU7XG4gICAgLy8gICAgICAgICAgICAgY29uc29sZS5sb2coXCIxXCIrdHJhZCk7XG4gICAgLy8gICAgIH0pXG4gICAgLy8gLy9yZXR1cm4gdHJhZCArXCJ5MlwiK3RvdG87XG4gICAgLy8gfTtcbiAgICAvLyBjb25zb2xlLmxvZyh3aWtpZGF0YV90cmFuc2xhdGUoXCJEcmFnb25cIiwgXCJ6aFwiKSAvKiovKVxuXG4gICAgLy8xYy4gRE9NIGluamVjdGlvbjpcbiAgICAvLyQoXCJib2R5XCIpLmh0bWwoJzxhIGhyZWY9XCInK3VybCsnXCI+TGluazwvYT4uPGJyIC8+JysgdXJsKTsgLy9wdWJsaXNoIHRoZSB1cmwuXG4gICAgLy8gd2QraSBJTmNvbnNpc3RlbnRseSBwcm92aWRlIHZhcmlhbnRzLlxuXG4gICAgLyogREVNTyAjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyAqL1xuICAgIC8qIDIuIFRFTVBMQVRJTkcgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICAvLyAyYS4gU2luZ2xlIHF1ZXJ5IDpcbiAgICBmdW5jdGlvbiBXUChpdGVtKSB7XG4gICAgICAgIHVybCAgID0gd3ArYXErdCsgaXRlbSArcCtyK2MrZjsgIGNvbnNvbGUubG9nKHVybCk7XG4gICAgICAgICQuZ2V0SlNPTih1cmwsIGZ1bmN0aW9uIChqc29uKSB7XG4gICAgICAgICAgICB2YXIgaXRlbV9pZCA9IE9iamVjdC5rZXlzKGpzb24ucXVlcnkucGFnZXMpWzBdOyAvLyBUSElTIERPIFRIRSBUUklDSyAhXG4gICAgICAgICAgICB2YXIgZXh0cmFjdCA9IGpzb24ucXVlcnkucGFnZXNbaXRlbV9pZF0uZXh0cmFjdDtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBcIjxiPkVuIDo8L2I+IDx0PlwiICsgaXRlbSArIFwiPC90PiA8Yj7ih5I8L2I+IFwiICsgZXh0cmFjdDtcbiAgICAgICAgICAgIC8vICQoJyNhbmNob3IxJykuYXBwZW5kKFwiPGRpdj5cIityZXN1bHQrXCI8L2Rpdj5cIik7IC8vIGFwcGVuZFxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2cocmVzdWx0KTtcbiAgICAgICAgICAgIGZpbmFsUiA9IHJlc3VsdDtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhmaW5hbFIpO1xuICAgICAgICB9KTtcbiAgICB9OyBcbiAgICBXUChpbnB1dCk7XG5cblxufTtcblxuXG4iXX0=

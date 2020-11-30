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
    audio3.src = "/source/Audio/radio.mp3";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9hbmFseXNlci1mcmVxdWVuY3ktYXZlcmFnZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9hdWRpby1mcmVxdWVuY3ktdG8taW5kZXgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY2xhbXAvaW5kZXguanMiLCJzb3VyY2UvYXBwLmpzIiwid2lraS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiJ3VzZSBzdHJpY3QnO1xudmFyIGFuYWx5c2VyRnJlcXVlbmN5ID0gcmVxdWlyZSgnYW5hbHlzZXItZnJlcXVlbmN5LWF2ZXJhZ2UnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihhdWRpb0NvbnRleHQsIHN0cmVhbSwgb3B0cywgc291cmNlQXVkaW8pIHtcblxuICBvcHRzID0gb3B0cyB8fCB7fTtcblxuICB2YXIgZGVmYXVsdHMgPSB7XG4gICAgZmZ0U2l6ZTogMTAyNCxcbiAgICBidWZmZXJMZW46IDEwMjQsXG4gICAgc21vb3RoaW5nVGltZUNvbnN0YW50OiAwLjIsXG4gICAgbWluQ2FwdHVyZUZyZXE6IDg1LCAgICAgICAgIC8vIGluIEh6XG4gICAgbWF4Q2FwdHVyZUZyZXE6IDI1NSwgICAgICAgIC8vIGluIEh6XG4gICAgbm9pc2VDYXB0dXJlRHVyYXRpb246IDEwMDAsIC8vIGluIG1zXG4gICAgbWluTm9pc2VMZXZlbDogMC4zLCAgICAgICAgIC8vIGZyb20gMCB0byAxXG4gICAgbWF4Tm9pc2VMZXZlbDogMC43LCAgICAgICAgIC8vIGZyb20gMCB0byAxXG4gICAgYXZnTm9pc2VNdWx0aXBsaWVyOiAxLjIsXG4gICAgb25Wb2ljZVN0YXJ0OiBmdW5jdGlvbigpIHtcbiAgICB9LFxuICAgIG9uVm9pY2VTdG9wOiBmdW5jdGlvbigpIHtcbiAgICB9LFxuICAgIG9uVXBkYXRlOiBmdW5jdGlvbih2YWwpIHtcbiAgICB9XG4gIH07XG5cbiAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgZm9yICh2YXIga2V5IGluIGRlZmF1bHRzKSB7XG4gICAgb3B0aW9uc1trZXldID0gb3B0cy5oYXNPd25Qcm9wZXJ0eShrZXkpID8gb3B0c1trZXldIDogZGVmYXVsdHNba2V5XTtcbiAgfVxuXG4gIHZhciBiYXNlTGV2ZWwgPSAwO1xuICB2YXIgdm9pY2VTY2FsZSA9IDE7XG4gIHZhciBhY3Rpdml0eUNvdW50ZXIgPSAwO1xuICB2YXIgYWN0aXZpdHlDb3VudGVyTWluID0gMDtcbiAgdmFyIGFjdGl2aXR5Q291bnRlck1heCA9IDYwO1xuICB2YXIgYWN0aXZpdHlDb3VudGVyVGhyZXNoID0gNTtcblxuICB2YXIgZW52RnJlcVJhbmdlID0gW107XG4gIHZhciBpc05vaXNlQ2FwdHVyaW5nID0gdHJ1ZTtcbiAgdmFyIHByZXZWYWRTdGF0ZSA9IHVuZGVmaW5lZDtcbiAgdmFyIHZhZFN0YXRlID0gZmFsc2U7XG4gIHZhciBjYXB0dXJlVGltZW91dCA9IG51bGw7XG5cbiAgdmFyIHNvdXJjZSA9IHNvdXJjZUF1ZGlvO1xuICAvLyB2YXIgc291cmNlID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhRWxlbWVudFNvdXJjZShzdHJlYW0pO1xuICAvLyB2YXIgc291cmNlID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG4gIHZhciBhbmFseXNlciA9IGF1ZGlvQ29udGV4dC5jcmVhdGVBbmFseXNlcigpO1xuICBhbmFseXNlci5zbW9vdGhpbmdUaW1lQ29uc3RhbnQgPSBvcHRpb25zLnNtb290aGluZ1RpbWVDb25zdGFudDtcbiAgYW5hbHlzZXIuZmZ0U2l6ZSA9IG9wdGlvbnMuZmZ0U2l6ZTtcblxuICB2YXIgc2NyaXB0UHJvY2Vzc29yTm9kZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3Iob3B0aW9ucy5idWZmZXJMZW4sIDEsIDEpO1xuICBjb25uZWN0KCk7XG4gIHNjcmlwdFByb2Nlc3Nvck5vZGUub25hdWRpb3Byb2Nlc3MgPSBtb25pdG9yO1xuXG4gIGlmIChpc05vaXNlQ2FwdHVyaW5nKSB7XG4gICAgLy9jb25zb2xlLmxvZygnVkFEOiBzdGFydCBub2lzZSBjYXB0dXJpbmcnKTtcbiAgICBjYXB0dXJlVGltZW91dCA9IHNldFRpbWVvdXQoaW5pdCwgb3B0aW9ucy5ub2lzZUNhcHR1cmVEdXJhdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBpbml0KCkge1xuICAgIC8vY29uc29sZS5sb2coJ1ZBRDogc3RvcCBub2lzZSBjYXB0dXJpbmcnKTtcbiAgICBpc05vaXNlQ2FwdHVyaW5nID0gZmFsc2U7XG5cbiAgICBlbnZGcmVxUmFuZ2UgPSBlbnZGcmVxUmFuZ2UuZmlsdGVyKGZ1bmN0aW9uKHZhbCkge1xuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9KS5zb3J0KCk7XG4gICAgdmFyIGF2ZXJhZ2VFbnZGcmVxID0gZW52RnJlcVJhbmdlLmxlbmd0aCA/IGVudkZyZXFSYW5nZS5yZWR1Y2UoZnVuY3Rpb24gKHAsIGMpIHsgcmV0dXJuIE1hdGgubWluKHAsIGMpIH0sIDEpIDogKG9wdGlvbnMubWluTm9pc2VMZXZlbCB8fCAwLjEpO1xuXG4gICAgYmFzZUxldmVsID0gYXZlcmFnZUVudkZyZXEgKiBvcHRpb25zLmF2Z05vaXNlTXVsdGlwbGllcjtcbiAgICBpZiAob3B0aW9ucy5taW5Ob2lzZUxldmVsICYmIGJhc2VMZXZlbCA8IG9wdGlvbnMubWluTm9pc2VMZXZlbCkgYmFzZUxldmVsID0gb3B0aW9ucy5taW5Ob2lzZUxldmVsO1xuICAgIGlmIChvcHRpb25zLm1heE5vaXNlTGV2ZWwgJiYgYmFzZUxldmVsID4gb3B0aW9ucy5tYXhOb2lzZUxldmVsKSBiYXNlTGV2ZWwgPSBvcHRpb25zLm1heE5vaXNlTGV2ZWw7XG5cbiAgICB2b2ljZVNjYWxlID0gMSAtIGJhc2VMZXZlbDtcblxuICAgIC8vY29uc29sZS5sb2coJ1ZBRDogYmFzZSBsZXZlbDonLCBiYXNlTGV2ZWwpO1xuICB9XG5cbiAgZnVuY3Rpb24gY29ubmVjdCgpIHtcbiAgICBzb3VyY2UuY29ubmVjdChhbmFseXNlcik7XG4gICAgYW5hbHlzZXIuY29ubmVjdChzY3JpcHRQcm9jZXNzb3JOb2RlKTtcbiAgICBzY3JpcHRQcm9jZXNzb3JOb2RlLmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRpc2Nvbm5lY3QoKSB7XG4gICAgc2NyaXB0UHJvY2Vzc29yTm9kZS5kaXNjb25uZWN0KCk7XG4gICAgYW5hbHlzZXIuZGlzY29ubmVjdCgpO1xuICAgIHNvdXJjZS5kaXNjb25uZWN0KCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95KCkge1xuICAgIGNhcHR1cmVUaW1lb3V0ICYmIGNsZWFyVGltZW91dChjYXB0dXJlVGltZW91dCk7XG4gICAgZGlzY29ubmVjdCgpO1xuICAgIHNjcmlwdFByb2Nlc3Nvck5vZGUub25hdWRpb3Byb2Nlc3MgPSBudWxsO1xuICB9XG5cbiAgZnVuY3Rpb24gbW9uaXRvcigpIHtcbiAgICB2YXIgZnJlcXVlbmNpZXMgPSBuZXcgVWludDhBcnJheShhbmFseXNlci5mcmVxdWVuY3lCaW5Db3VudCk7XG4gICAgYW5hbHlzZXIuZ2V0Qnl0ZUZyZXF1ZW5jeURhdGEoZnJlcXVlbmNpZXMpO1xuXG4gICAgdmFyIGF2ZXJhZ2UgPSBhbmFseXNlckZyZXF1ZW5jeShhbmFseXNlciwgZnJlcXVlbmNpZXMsIG9wdGlvbnMubWluQ2FwdHVyZUZyZXEsIG9wdGlvbnMubWF4Q2FwdHVyZUZyZXEpO1xuICAgIGlmIChpc05vaXNlQ2FwdHVyaW5nKSB7XG4gICAgICBlbnZGcmVxUmFuZ2UucHVzaChhdmVyYWdlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoYXZlcmFnZSA+PSBiYXNlTGV2ZWwgJiYgYWN0aXZpdHlDb3VudGVyIDwgYWN0aXZpdHlDb3VudGVyTWF4KSB7XG4gICAgICBhY3Rpdml0eUNvdW50ZXIrKztcbiAgICB9IGVsc2UgaWYgKGF2ZXJhZ2UgPCBiYXNlTGV2ZWwgJiYgYWN0aXZpdHlDb3VudGVyID4gYWN0aXZpdHlDb3VudGVyTWluKSB7XG4gICAgICBhY3Rpdml0eUNvdW50ZXItLTtcbiAgICB9XG4gICAgdmFkU3RhdGUgPSBhY3Rpdml0eUNvdW50ZXIgPiBhY3Rpdml0eUNvdW50ZXJUaHJlc2g7XG5cbiAgICBpZiAocHJldlZhZFN0YXRlICE9PSB2YWRTdGF0ZSkge1xuICAgICAgdmFkU3RhdGUgPyBvblZvaWNlU3RhcnQoKSA6IG9uVm9pY2VTdG9wKCk7XG4gICAgICBwcmV2VmFkU3RhdGUgPSB2YWRTdGF0ZTtcbiAgICB9XG5cbiAgICBvcHRpb25zLm9uVXBkYXRlKE1hdGgubWF4KDAsIGF2ZXJhZ2UgLSBiYXNlTGV2ZWwpIC8gdm9pY2VTY2FsZSk7XG4gIH1cblxuICBmdW5jdGlvbiBvblZvaWNlU3RhcnQoKSB7XG4gICAgb3B0aW9ucy5vblZvaWNlU3RhcnQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uVm9pY2VTdG9wKCkge1xuICAgIG9wdGlvbnMub25Wb2ljZVN0b3AoKTtcbiAgfVxuXG4gIHJldHVybiB7Y29ubmVjdDogY29ubmVjdCwgZGlzY29ubmVjdDogZGlzY29ubmVjdCwgZGVzdHJveTogZGVzdHJveX07XG59OyIsInZhciBmcmVxdWVuY3lUb0luZGV4ID0gcmVxdWlyZSgnYXVkaW8tZnJlcXVlbmN5LXRvLWluZGV4JylcblxubW9kdWxlLmV4cG9ydHMgPSBhbmFseXNlckZyZXF1ZW5jeUF2ZXJhZ2UuYmluZChudWxsLCAyNTUpXG5tb2R1bGUuZXhwb3J0cy5mbG9hdERhdGEgPSBhbmFseXNlckZyZXF1ZW5jeUF2ZXJhZ2UuYmluZChudWxsLCAxKVxuXG5mdW5jdGlvbiBhbmFseXNlckZyZXF1ZW5jeUF2ZXJhZ2UgKGRpdiwgYW5hbHlzZXIsIGZyZXF1ZW5jaWVzLCBtaW5IeiwgbWF4SHopIHtcbiAgdmFyIHNhbXBsZVJhdGUgPSBhbmFseXNlci5jb250ZXh0LnNhbXBsZVJhdGVcbiAgdmFyIGJpbkNvdW50ID0gYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnRcbiAgdmFyIHN0YXJ0ID0gZnJlcXVlbmN5VG9JbmRleChtaW5Ieiwgc2FtcGxlUmF0ZSwgYmluQ291bnQpXG4gIHZhciBlbmQgPSBmcmVxdWVuY3lUb0luZGV4KG1heEh6LCBzYW1wbGVSYXRlLCBiaW5Db3VudClcbiAgdmFyIGNvdW50ID0gZW5kIC0gc3RhcnRcbiAgdmFyIHN1bSA9IDBcbiAgZm9yICg7IHN0YXJ0IDwgZW5kOyBzdGFydCsrKSB7XG4gICAgc3VtICs9IGZyZXF1ZW5jaWVzW3N0YXJ0XSAvIGRpdlxuICB9XG4gIHJldHVybiBjb3VudCA9PT0gMCA/IDAgOiAoc3VtIC8gY291bnQpXG59XG4iLCJ2YXIgY2xhbXAgPSByZXF1aXJlKCdjbGFtcCcpXG5cbm1vZHVsZS5leHBvcnRzID0gZnJlcXVlbmN5VG9JbmRleFxuZnVuY3Rpb24gZnJlcXVlbmN5VG9JbmRleCAoZnJlcXVlbmN5LCBzYW1wbGVSYXRlLCBmcmVxdWVuY3lCaW5Db3VudCkge1xuICB2YXIgbnlxdWlzdCA9IHNhbXBsZVJhdGUgLyAyXG4gIHZhciBpbmRleCA9IE1hdGgucm91bmQoZnJlcXVlbmN5IC8gbnlxdWlzdCAqIGZyZXF1ZW5jeUJpbkNvdW50KVxuICByZXR1cm4gY2xhbXAoaW5kZXgsIDAsIGZyZXF1ZW5jeUJpbkNvdW50KVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBjbGFtcFxuXG5mdW5jdGlvbiBjbGFtcCh2YWx1ZSwgbWluLCBtYXgpIHtcbiAgcmV0dXJuIG1pbiA8IG1heFxuICAgID8gKHZhbHVlIDwgbWluID8gbWluIDogdmFsdWUgPiBtYXggPyBtYXggOiB2YWx1ZSlcbiAgICA6ICh2YWx1ZSA8IG1heCA/IG1heCA6IHZhbHVlID4gbWluID8gbWluIDogdmFsdWUpXG59XG4iLCIoZnVuY3Rpb24gKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIC8vIERlY2xhcmluZyB2YXJpYWJsZXNcbiAgICB3aW5kb3cuQXVkaW9Db250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuICAgIHZhciB2YWQgPSByZXF1aXJlKCcuLi9pbmRleC5qcycpO1xuICAgIHZhciB3aWtpID0gcmVxdWlyZSgnLi4vd2lraS5qcycpO1xuICAgIHZhciBpbnRyb2R1Y3Rpb24gPSBmYWxzZTtcbiAgICB2YXIgbmV3Q2hhbm5lbCA9IGZhbHNlO1xuICAgIHZhciBhdWRpb1NyYztcbiAgICB2YXIgYXVkaW8yU3JjO1xuICAgIHZhciBqZGF0YSA9IFtdO1xuICAgIHZhciBjb3VudGVyID0gMDtcbiAgICB2YXIgY291bnRlcjIgPSAwO1xuICAgIHZhciB2YWRWYWw7XG4gICAgdmFyIHZhZFZhbENvdW50ZXI7XG4gICAgdmFyIHZhZFZhbEF2ZXJhZ2U7XG4gICAgdmFyIHR4dDtcbiAgICB2YXIgaSA9IDA7XG4gICAgdmFyIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgLy8gdmFyIGNvbnRleHQgPSBuZXcgKHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCkoKTtcbiAgICB2YXIgYXVkaW8gPSBuZXcgQXVkaW8oKTtcbiAgICB2YXIgYXVkaW8yID0gbmV3IEF1ZGlvKCk7XG4gICAgdmFyIGF1ZGlvMyA9IG5ldyBBdWRpbygpO1xuICAgIGF1ZGlvMy5zcmMgPSBcIi9zb3VyY2UvQXVkaW8vcmFkaW8ubXAzXCI7XG4gICAgYXVkaW8zLnZvbHVtZSA9IDAuNTtcbiAgICB2YXIgc291cmNlQXVkaW8gPSBjb250ZXh0LmNyZWF0ZU1lZGlhRWxlbWVudFNvdXJjZShhdWRpbzIpO1xuICAgIHZhciB2b2x1bWUgPSBjb250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICBjb25zdCBpbnRyb0RpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiaW50cm9cIik7XG4gICAgY29uc3QgY2VzaXVtQ29udGFpbmVyRGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjZXNpdW1Db250YWluZXJcIik7XG4gICAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ215LWJ1dHRvbicpOyAvLyBhZGQgaWQ9XCJteS1idXR0b25cIiBpbnRvIGh0bWxcbiAgICBjb25zdCB3aWtpSW5mb0RpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3aWtpSW5mbycpO1xuICAgIGNvbnN0IHJhZGlvVG93ZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmFkaW9Ub3dlcicpO1xuICAgIGNvbnN0IGxvYWRpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9hZGluZycpO1xuXG4gICAgLy8gSGlkZSBlbGVtZW50cyBiZWZvcmUgZ2V0dGluZyB0aGUganNvbiBmaWxlXG4gICAgaW50cm9EaXYuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIGNlc2l1bUNvbnRhaW5lckRpdi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgcmFkaW9Ub3dlci5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgd2lraUluZm9EaXYuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIGxvYWRpbmcuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXG4gICAgLy8gR2V0dGluZyB0aGUgSlNPTiBmaWxlIGFuZCBzaHVmZmxpbmcgdGhlIGFycmF5IGZvciByYW5kb20gcmVzdWx0c1xuICAgIGZldGNoKFwiLi9Tb3VyY2UvcmFkaW9zLmpzb25cIilcbiAgICAudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgICAgIHJldHVybiByZXNwLmpzb24oKTtcbiAgICB9KVxuICAgIC50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgamRhdGEgPSBkYXRhO1xuICAgICAgICBzaHVmZmxlKGpkYXRhKTtcbiAgICAgICAgZ290RGF0YSgpO1xuICAgIH0pO1xuXG4gICAgLy8gSW5pdGlhbGl6aW5nIHRoZSBtYXAgYW5kIHNob3dpbmcgdGhlIHN0YXJ0IGJ1dHRvbiBhZnRlciBnZXR0aW5nIHRoZSBkYXRhXG4gICAgZnVuY3Rpb24gZ290RGF0YSgpIHtcbiAgICAgICAgY29uc29sZS5sb2coamRhdGEpO1xuICAgICAgICBtYXBJbml0UG9zKCk7XG4gICAgICAgIGJpbGxib2FyZCgpO1xuICAgICAgICBpbnRyb0Rpdi5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBidXR0b25DbGljayk7XG4gICAgfVxuXG4gICAgLy8gU3RhcnRpbmcgdGhlIGF1ZGlvIGFmdGVyIGNsaWNraW5nIHN0YXJ0XG4gICAgZnVuY3Rpb24gYnV0dG9uQ2xpY2soKSB7XG4gICAgICAgIHJhZGlvVGVzdCgpO1xuICAgICAgICBjZXNpdW1Db250YWluZXJEaXYuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgYnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgbG9hZGluZy5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICBkaXNhYmxlSW5wdXRzKCk7XG4gICAgfVxuXG4gICAgLy8gRnVuY3Rpb24gdGhhdCBhZGQgYSByZWQgZG90IGF0IHRhcmdldHMgbG9jYXRpb25cbiAgICBmdW5jdGlvbiBiaWxsYm9hcmQoKSB7XG4gICAgICAgIHZpZXdlci5lbnRpdGllcy5hZGQoe1xuICAgICAgICAgICAgcG9zaXRpb246IG5ldyBDZXNpdW0uQ2FydGVzaWFuMy5mcm9tRGVncmVlcyhqZGF0YVtjb3VudGVyXS5sb2NbMF0sIGpkYXRhW2NvdW50ZXJdLmxvY1sxXSwgMSksXG4gICAgICAgICAgICBiaWxsYm9hcmQ6IHtcbiAgICAgICAgICAgICAgICBpbWFnZTogXCIuL1NvdXJjZS9JbWFnZXMvZG90LnBuZ1wiLFxuICAgICAgICAgICAgICAgIHNjYWxlOiAwLjAxXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICB9XG5cblxuICAgIC8vIEZ1bmN0aW9uIHRoYXQgZmxpZXMgdG8gYSBuZXcgbG9jYXRpb24gZXZlcnkgMTUgc2Vjb25kc1xuICAgIGZ1bmN0aW9uIGNoYW5nZSgpIHtcbiAgICAgICAgYXVkaW8zLnBhdXNlKCk7XG4gICAgICAgIGF1ZGlvMy5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIGludHJvRGl2LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgcmFkaW9Ub3dlci5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY2hhbmdlOiBjb3VudGVyID0gXCIrY291bnRlcik7XG4gICAgICAgIHdpa2koamRhdGFbY291bnRlcl0uY2l0eSwgZnVuY3Rpb24ocmVzcG9uc2Upe1xuICAgICAgICAgICAgY29uc29sZS5sb2cocmVzcG9uc2UpO1xuICAgICAgICAgICAgd2lraUluZm9EaXYuaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgICAgIHR4dCA9IHJlc3BvbnNlO1xuICAgICAgICAgICAgLy8gJChcIiN3aWtpSW5mb1wiKS5hcHBlbmQocmVzcG9uc2UpOy8vIGFwcGVuZFxuICAgICAgICAgICAgLy8gJChcIiN3aWtpSW5mb1wiKS5hcHBlbmQoXCI8ZGl2PlwiK3Jlc3BvbnNlK1wiPC9kaXY+XCIpOy8vIGFwcGVuZFxuICAgICAgICAgICAgd2lraUluZm9EaXYuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgICAgIHR5cGVXcml0ZXIoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHZpZXdlci5zY2VuZS5jYW1lcmEuZmx5VG8oe1xuICAgICAgICAgICAgZGVzdGluYXRpb246IG5ldyBDZXNpdW0uQ2FydGVzaWFuMy5mcm9tRGVncmVlcyhqZGF0YVtjb3VudGVyXS5sb2NbMF0sIGpkYXRhW2NvdW50ZXJdLmxvY1sxXSwgamRhdGFbY291bnRlcl0ubG9jWzJdKSxcbiAgICAgICAgICAgIGR1cmF0aW9uOiAxNSxcbiAgICAgICAgICAgIGNvbXBsZXRlOiBmbHlFbmRcbiAgICAgICAgfSk7XG4gICAgICAgIHZpZXdlci5lbnRpdGllcy5hZGQoe1xuICAgICAgICAgICAgcG9zaXRpb246IG5ldyBDZXNpdW0uQ2FydGVzaWFuMy5mcm9tRGVncmVlcyhqZGF0YVtjb3VudGVyXS5sb2NbMF0sIGpkYXRhW2NvdW50ZXJdLmxvY1sxXSwgMSksXG4gICAgICAgICAgICBiaWxsYm9hcmQ6IHtcbiAgICAgICAgICAgICAgICBpbWFnZTogXCIuL1NvdXJjZS9JbWFnZXMvZG90LnBuZ1wiLFxuICAgICAgICAgICAgICAgIHNjYWxlOiAwLjAxXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgbXlUaW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGludHJvZHVjdGlvbiA9IGZhbHNlO1xuICAgICAgICAgICAgLy8gY2hhbmdlKCk7XG4gICAgICAgIH0sIDMwMDAwKTtcbiAgICB9XG5cbiAgICAvLyBTaHVmZmxlIGFuIGFycmF5XG4gICAgZnVuY3Rpb24gc2h1ZmZsZShhcnJheSkge1xuICAgICAgICB2YXIgY3VycmVudEluZGV4ID0gYXJyYXkubGVuZ3RoLCB0ZW1wb3JhcnlWYWx1ZSwgcmFuZG9tSW5kZXg7XG4gICAgICBcbiAgICAgICAgLy8gV2hpbGUgdGhlcmUgcmVtYWluIGVsZW1lbnRzIHRvIHNodWZmbGUuLi5cbiAgICAgICAgd2hpbGUgKDAgIT09IGN1cnJlbnRJbmRleCkge1xuICAgICAgXG4gICAgICAgICAgLy8gUGljayBhIHJlbWFpbmluZyBlbGVtZW50Li4uXG4gICAgICAgICAgcmFuZG9tSW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjdXJyZW50SW5kZXgpO1xuICAgICAgICAgIGN1cnJlbnRJbmRleCAtPSAxO1xuICAgICAgXG4gICAgICAgICAgLy8gQW5kIHN3YXAgaXQgd2l0aCB0aGUgY3VycmVudCBlbGVtZW50LlxuICAgICAgICAgIHRlbXBvcmFyeVZhbHVlID0gYXJyYXlbY3VycmVudEluZGV4XTtcbiAgICAgICAgICBhcnJheVtjdXJyZW50SW5kZXhdID0gYXJyYXlbcmFuZG9tSW5kZXhdO1xuICAgICAgICAgIGFycmF5W3JhbmRvbUluZGV4XSA9IHRlbXBvcmFyeVZhbHVlO1xuICAgICAgICB9XG4gICAgICBcbiAgICAgICAgcmV0dXJuIGFycmF5O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHR5cGVXcml0ZXIoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidHlwaW5nXCIpXG4gICAgICAgIGlmIChpIDwgdHh0Lmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gd2lraUluZm9EaXYuaW5uZXJIVE1MICs9IHR4dC5jaGFyQXQoaSk7XG4gICAgICAgICAgICBpZih0eHRbaV0gPT0gXCI8XCIgJiYgdHh0W2krMV0gIT0gXCIvXCIpe1xuICAgICAgICAgICAgICAgICQoXCIjd2lraUluZm9cIikuYXBwZW5kKHR4dFtpXSt0eHRbaSsxXSt0eHRbaSsyXSk7XG4gICAgICAgICAgICAgICAgaSArPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZih0eHRbaV0gPT0gXCI8XCIgJiYgdHh0W2krMV0gPT0gXCIvXCIpe1xuICAgICAgICAgICAgICAgICQoXCIjd2lraUluZm9cIikuYXBwZW5kKHR4dFtpXSt0eHRbaSsxXSt0eHRbaSsyXSt0eHRbaSszXSk7XG4gICAgICAgICAgICAgICAgaSArPSA0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgJChcIiN3aWtpSW5mb1wiKS5hcHBlbmQodHh0W2ldKTtcbiAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXRUaW1lb3V0KHR5cGVXcml0ZXIsIDUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGkgPSB0eHQubGVuZ3RoKSB7XG4gICAgICAgICAgICBpID0gMDtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gU1RBUlQgT0YgTUFQIFNUVUZGXG4gICAgLy8gVE9ETzogQWRkIHlvdXIgaW9uIGFjY2VzcyB0b2tlbiBmcm9tIGNlc2l1bS5jb20vaW9uL1xuICAgIENlc2l1bS5Jb24uZGVmYXVsdEFjY2Vzc1Rva2VuID0gJ2V5SmhiR2NpT2lKSVV6STFOaUlzSW5SNWNDSTZJa3BYVkNKOS5leUpxZEdraU9pSmhORGsxTldReVlpMWtOV0U1TFRSa1pHSXRPRGt3WWkwd1l6SmpPVEl5WTJNNVptUWlMQ0pwWkNJNk16ZzFNREFzSW1saGRDSTZNVFl3TmpRd05USXdNMzAuSV81SHd2SEgtVmtlRUotaWU1alZoVXZYV1liZklnb3JrdFY5VEFWYzhMVSc7XG5cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIC8vIENyZWF0aW5nIHRoZSBWaWV3ZXJcbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIC8vIHZhciBvc20gPSBuZXcgQ2VzaXVtLmNyZWF0ZU9wZW5TdHJlZXRNYXBJbWFnZXJ5UHJvdmlkZXIoe1xuICAgIC8vICAgICB1cmwgOiAnaHR0cHM6Ly9hLnRpbGUub3BlbnN0cmVldG1hcC5vcmcvJ1xuICAgIC8vIH0pO1xuXG4gICAgdmFyIHZpZXdlciA9IG5ldyBDZXNpdW0uVmlld2VyKCdjZXNpdW1Db250YWluZXInLCB7XG4gICAgICAgIHNjZW5lM0RPbmx5OiB0cnVlLFxuICAgICAgICBzZWxlY3Rpb25JbmRpY2F0b3I6IGZhbHNlLFxuICAgICAgICBiYXNlTGF5ZXJQaWNrZXI6IHRydWUsXG4gICAgICAgIGhvbWVCdXR0b246IGZhbHNlLFxuICAgICAgICB0aW1lbGluZTogZmFsc2UsXG4gICAgICAgIGdlb2NvZGVyOiB0cnVlLFxuICAgICAgICBuYXZpZ2F0aW9uSGVscEJ1dHRvbjogZmFsc2UsXG4gICAgICAgIGFuaW1hdGlvbjogZmFsc2UsXG4gICAgICAgIGNyZWRpdENvbnRhaW5lcjogXCJjcmVkaXRDb250YWluZXJcIixcbiAgICAgICAgZnVsbHNjcmVlbkJ1dHRvbjogZmFsc2UsXG4gICAgICAgIHNoYWRvd3M6IHRydWVcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGZseUVuZCgpIHtcbiAgICAgICAgcmFkaW9Ub3dlci5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICAvLyByYWRpb1Rvd2VyLnNyYyA9IFwiL3NvdXJjZS9JbWFnZXMvcmFkaW9HaWYuZ2lmXCI7XG4gICAgICAgIHJhZGlvVG93ZXIuc3JjID0gcmFkaW9Ub3dlci5zcmMucmVwbGFjZSgvXFw/LiokLyxcIlwiKStcIj94PVwiK01hdGgucmFuZG9tKCk7XG4gICAgICAgIGRpc2FibGVJbnB1dHMoKTtcbiAgICAgICAgdmlld2VyLnNjZW5lLmNhbWVyYS5mbHlUbyh7XG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogbmV3IENlc2l1bS5DYXJ0ZXNpYW4zLmZyb21EZWdyZWVzKGpkYXRhW2NvdW50ZXJdLmxvY1swXSwgamRhdGFbY291bnRlcl0ubG9jWzFdLCBqZGF0YVtjb3VudGVyXS5sb2NbMl0tMTAwMCksXG4gICAgICAgICAgICBkdXJhdGlvbjogMjBcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlzYWJsZUlucHV0cygpIHtcbiAgICAgICAgLy8gZm9yIHNvbWUgcmVhc29uIHRoZSBmbHlUbyBmdW5jdGlvbiBlbmFibGVzIGlucHV0cyBhdCB0aGUgZW5kIGFmdGVyIHRoZSBjYWxsIG9mIHRoaXMgZnVuY3Rpb25cbiAgICAgICAgLy8gRGlzYWJsaW5nIGl0IG9uZSAxbXMgYWZ0ZXIgc2VlbXMgdG8gZml4IHRoaXMgaXNzdWVzXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHZpZXdlci5zY2VuZS5zY3JlZW5TcGFjZUNhbWVyYUNvbnRyb2xsZXIuZW5hYmxlSW5wdXRzID0gZmFsc2U7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImlucHV0cyBkaXNhYmxlZFwiKTtcbiAgICAgICAgfSwxKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1hcEluaXRQb3MoKSB7XG4gICAgICAgIC8vIC8vIC8vIENyZWF0ZSBhbiBpbml0aWFsIGNhbWVyYSB2aWV3XG4gICAgICAgIHZhciBpbml0aWFsUG9zaXRpb24gPSBuZXcgQ2VzaXVtLkNhcnRlc2lhbjMuZnJvbURlZ3JlZXMoamRhdGFbMF0ubG9jWzBdLCBqZGF0YVswXS5sb2NbMV0sIDEwMDAwMDAwKTtcbiAgICAgICAgdmFyIGluaXRpYWxPcmllbnRhdGlvbiA9IG5ldyBDZXNpdW0uSGVhZGluZ1BpdGNoUm9sbC5mcm9tRGVncmVlcygwLCAtOTAsIDApO1xuXG4gICAgICAgIHZhciBob21lQ2FtZXJhVmlldyA9IHtcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uIDogaW5pdGlhbFBvc2l0aW9uLFxuICAgICAgICAgICAgb3JpZW50YXRpb24gOiB7XG4gICAgICAgICAgICAgICAgaGVhZGluZyA6IGluaXRpYWxPcmllbnRhdGlvbi5oZWFkaW5nLFxuICAgICAgICAgICAgICAgIHBpdGNoIDogaW5pdGlhbE9yaWVudGF0aW9uLnBpdGNoLFxuICAgICAgICAgICAgICAgIHJvbGwgOiBpbml0aWFsT3JpZW50YXRpb24ucm9sbFxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICAvLyBTZXQgdGhlIGluaXRpYWwgdmlld1xuICAgICAgICAvLyB3aWRnZXQuc2NlbmUuY2FtZXJhLnNldFZpZXcoaG9tZUNhbWVyYVZpZXcpO1xuICAgICAgICB2aWV3ZXIuc2NlbmUuY2FtZXJhLnNldFZpZXcoaG9tZUNhbWVyYVZpZXcpO1xuICAgIH1cblxuXG4gICAgLy8gU1RBUlQgT0YgQVVESU8gU1RVRkZcbiAgICAvLyBDb25uZWN0aW5nIHRvIHRoZSBhdWRpbyBjb250ZXh0IGFuZCBzdGFydGluZyB0aGUgYW5hbHlzZXJcbiAgICBmdW5jdGlvbiByYWRpb1Rlc3QoKSB7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgcmFkaW9UZXN0KTtcbiAgICAgICAgYXVkaW8uY3Jvc3NPcmlnaW4gPSAnYW5vbnltb3VzJzsgLy8gVXNlZnVsIHRvIHBsYXkgaG9zdGVkIGxpdmUgc3RyZWFtIHdpdGggQ09SUyBlbmFibGVkXG4gICAgICAgIGF1ZGlvMi5jcm9zc09yaWdpbiA9ICdhbm9ueW1vdXMnOyAvLyBVc2VmdWwgdG8gcGxheSBob3N0ZWQgbGl2ZSBzdHJlYW0gd2l0aCBDT1JTIGVuYWJsZWRcbiAgICAgICAgc291cmNlQXVkaW8uY29ubmVjdCh2b2x1bWUpO1xuICAgICAgICAvLyBzb3VyY2VBdWRpby5jb25uZWN0KGNvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICB2b2x1bWUuY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICAgICAgdm9sdW1lLmdhaW4udmFsdWUgPSAwO1xuICAgICAgICBhdWRpbzJTb3VyY2UoKTtcbiAgICB9XG5cbiAgICAvLyBBY3R1YWwgYXVkaW8gdG8gYmUgcGxheWVkIGFuZCBoZWFyZFxuICAgIGNvbnN0IHBsYXlIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInBsYXlcIik7XG4gICAgICAgIGF1ZGlvLnBsYXkoKTtcbiAgICAgICAgY2hhbmdlKCk7XG4gICAgICAgIC8vcmFkaW9Ub3dlci5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NhbnBsYXl0aHJvdWdoJywgcGxheUhhbmRsZXIpO1xuICAgIH07XG4gICAgLy8gTXV0ZWQgYXVkaW8gdGhhdCBpcyBiZWluZyBhbmFseXplZFxuICAgIGNvbnN0IHBsYXkySGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJwbGF5MlwiKTtcbiAgICAgICAgYXVkaW8yLnBsYXkoKTtcbiAgICAgICAgYXVkaW8yLm11dGVkID0gZmFsc2U7XG4gICAgICAgIG5ld0NoYW5uZWwgPSBmYWxzZTtcbiAgICAgICAgYXVkaW8yLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NhbnBsYXl0aHJvdWdoJywgcGxheTJIYW5kbGVyKTtcbiAgICAgICAgc3RhcnRVc2VyTWVkaWEoYXVkaW8yKTtcbiAgICB9O1xuXG4gICAgLy8gRXJyb3IgaGFuZGxlcnNcbiAgICBjb25zdCBlcnJvckhhbmRsZXIgPSBlID0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3InLCBlKTtcbiAgICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCBlcnJvckhhbmRsZXIpO1xuICAgIH07XG4gICAgY29uc3QgZXJyb3IySGFuZGxlciA9IGUgPT4ge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvcjInLCBlKTtcbiAgICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3IyJywgZXJyb3IySGFuZGxlcik7XG4gICAgfTtcbiAgICBcbiAgICAvLyBBdWRpbyBzb3VyY2Ugd2lsbCBiZSBjYWxsZWQgaWYgYSBnb29kIGF1ZGlvMiBpcyBmb3VuZFxuICAgIGZ1bmN0aW9uIGF1ZGlvU291cmNlKCkge1xuICAgICAgICBhdWRpbzMucGxheSgpO1xuICAgICAgICBhdWRpb1NyYyA9IGpkYXRhW2NvdW50ZXJdLnNyYztcbiAgICAgICAgYXVkaW8uc3JjID0gYXVkaW9TcmM7XG4gICAgICAgIGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2NhbnBsYXl0aHJvdWdoJywgcGxheUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgYXVkaW8uYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBlcnJvckhhbmRsZXIpO1xuICAgIH1cblxuICAgIC8vIENoYW5naW5nIHRoZSBhdWRpbzIgc291cmNlXG4gICAgZnVuY3Rpb24gYXVkaW8yU291cmNlKCkge1xuICAgICAgICBhdWRpbzJTcmMgPSBqZGF0YVtjb3VudGVyMl0uc3JjO1xuICAgICAgICBhdWRpbzIuc3JjID0gYXVkaW8yU3JjO1xuICAgICAgICBhdWRpbzIuYWRkRXZlbnRMaXN0ZW5lcignY2FucGxheXRocm91Z2gnLCBwbGF5MkhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgYXVkaW8yLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yMicsIGVycm9yMkhhbmRsZXIpO1xuICAgIH1cblxuICAgIC8vIEFuYWx5emVyXG4gICAgZnVuY3Rpb24gc3RhcnRVc2VyTWVkaWEoc3RyZWFtKSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic3RhcnRVc2VyTWVkaWEhXCIpO1xuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIG9uVm9pY2VTdGFydDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3ZvaWNlIHN0YXJ0Jyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25Wb2ljZVN0b3A6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd2b2ljZSBzdG9wJyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgb25VcGRhdGU6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgICAgICAgIC8vIGF1ZGlvMi5tdXRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdjdXJyIHZhbDonLCB2YWwpO1xuICAgICAgICAgICAgICAgIC8vIENhbGN1bGF0aW5nIGFuIGF2ZXJhZ2Ugc28gd2Uga25vdyB0aGVyZSBpcyB2b2ljZSBhY3Rpdml0eVxuICAgICAgICAgICAgICAgIGlmICh2YWRWYWxDb3VudGVyIDwgMjAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhZFZhbENvdW50ZXIgKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIjEwMCB2YWx1ZXMhXCIpXG4gICAgICAgICAgICAgICAgICAgIHZhZFZhbENvdW50ZXIgPSAxO1xuICAgICAgICAgICAgICAgICAgICB2YWRWYWwgPSAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YWRWYWwgKz0gdmFsO1xuICAgICAgICAgICAgICAgIHZhZFZhbEF2ZXJhZ2UgPSB2YWRWYWwgLyB2YWRWYWxDb3VudGVyO1xuXG4gICAgICAgICAgICAgICAgLy8gSWYgd2UgZ2V0IGEgZ29vZCBhdWRpbyB3ZSBjYW4gYXNzb2NpYXRlIHRoZSBhdWRpbzIgdG8gdGhlIGFjdHVhbCBhdWRpb1xuICAgICAgICAgICAgICAgIGlmKCFpbnRyb2R1Y3Rpb24gJiYgdmFkVmFsQXZlcmFnZSA+IDAuMiAmJiB2YWRWYWxDb3VudGVyID09IDIwMCl7XG4gICAgICAgICAgICAgICAgICAgIGludHJvZHVjdGlvbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNvdW50ZXIgPSBjb3VudGVyMjtcbiAgICAgICAgICAgICAgICAgICAgYXVkaW9Tb3VyY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYoY291bnRlcjIgPCBqZGF0YS5sZW5ndGgtMSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudGVyMisrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coY291bnRlcjIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaHVmZmxlKGpkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50ZXIyID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicmVzZXRcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYXVkaW8yU291cmNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEVsc2Ugd2UgZ28gdG8gdGhlIG5leHQgZW50cnkgb24gdGhlIGxpc3RcbiAgICAgICAgICAgICAgICBlbHNlIGlmKCFpbnRyb2R1Y3Rpb24gJiYgIW5ld0NoYW5uZWwgJiZ2YWRWYWxBdmVyYWdlIDwgMC4yICYmIHZhZFZhbENvdW50ZXIgPT0gMjAwKXtcbiAgICAgICAgICAgICAgICAgICAgbmV3Q2hhbm5lbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGlmKGNvdW50ZXIyIDwgamRhdGEubGVuZ3RoLTEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgY291bnRlcjIrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNvdW50ZXIyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNle1xuICAgICAgICAgICAgICAgICAgICAgICAgc2h1ZmZsZShqZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudGVyMiA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlc2V0XCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGF1ZGlvMlNvdXJjZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBhdWRpbzIubXV0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB2YWQoY29udGV4dCwgc3RyZWFtLCBvcHRpb25zLCBzb3VyY2VBdWRpbyk7XG4gICAgfVxuXG5cbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGlucHV0RGF0YSwgY2FsbGJhY2spIHtcblxuICAgIC8qIFBSSU5DSVBMRVMgIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMgKi9cbiAgICAvLyAxLiBBUEknUyBVUkw6XG4gICAgLy8gMWEuUGFydHMgb2YgdGhlIHVybDpcbiAgICB3ZCA9IFwiaHR0cHM6Ly93d3cud2lraWRhdGEub3JnL3cvYXBpLnBocD9cIjtcbiAgICB3cCA9IFwiaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3cvYXBpLnBocD9cIjsgLy8gbGlzdCBvZiBpc28tY29kZSA9ID8gLS0tLS0tLS0tLS0tLS0tLTxcbiAgICBhdyA9IFwiYWN0aW9uPXdiZ2V0ZW50aXRpZXNcIiA7IC8vIHJhdGhlciB3ZHBvaW50XG4gICAgYXEgPSBcImFjdGlvbj1xdWVyeVwiIDsgLy8gP3JhdGhlciB3cHBhZ2VcbiAgICB0cyA9IFwiJnNpdGVzPWVud2lraVwiIDsgLy8gd2Qgb25seSZyZXF1aXJlZC4gLy8gbGlzdCBvZiB3aWtpLWNvZGUgPSA/IC0tLS0tLS0tLS0tLS0tPFxuICAgIHQgPSBcIiZ0aXRsZXM9XCIgLy8gdGFyZ2V0LCB3ZHx3cFxuICAgIGkgPSBcIk1vbnRyZWFsXCI7IC8vaXRlbSwgd2R8d3BcbiAgICAvLyBpX2h0ID0gXCLvvIrvvZ7nsbPlrZfpjbXvvZ5cIiA7IC8vIHdkcG9pbnR8d3BwYWdlIC0tICtmZXcgZGF0YVxuICAgIC8vIGlfaHMgPSBcIu+8iu+9nuexs+Wtl+mUru+9nlwiIDsgLy8gd2Rwb2ludDogbWlzc2luZzsgd3BwYWdlOiByZWRpcmVjdCAoY29uZmlybWVkKVxuICAgIC8vIGlfaHQgPSBcIuS4reWci1wiIDsgLy8gd2Rwb2ludHx3cHBhZ2UgLS0gK21hbnkgZGF0YVxuICAgIC8vIGlfaHMgPSBcIuS4reWbvVwiIDsgLy8gd2Rwb2ludDogbWlzc2luZzsgd3BwYWdlOiByZWRpcmVjdCAoaWRlbSlcbiAgICBsICA9IFwiJmxhbmd1YWdlcz16aHx6aC1jbGFzc2ljYWx8emgtY258emgtaGFuc3x6aC1oYW50fHpoLWhrfHpoLW1pbi1uYW58emgtbW98emgtbXl8emgtc2d8emgtdHd8ZnJcIiA7IC8vIHdkcG9pbnQgb25seVxuICAgIHBzID0gXCImcHJvcHM9c2l0ZWxpbmtzfGxhYmVsc3xhbGlhc2VzfGRlc2NyaXB0aW9uc1wiIDsgLy8gd2Rwb2ludCBvbmx5XG4gICAgLy9zaXRlbGlua3M6IGFsbCBpbnRlcndpa2lzXG4gICAgLy9sYWJlbHM6IHRpdGxlIHdpdGhvdXQgXyh0YWcpLCBmb3IgbCAobGFuZ3VhZ2VzKSBvbmx5XG4gICAgLy9hbGlhc2VzOiBsYWJlbCBvZiByZWRpcmVjdCBwYWdlXG4gICAgcCA9IFwiJnByb3A9ZXh0cmFjdHMmZXhpbnRybyZleHBsYWludGV4dCZleHNlbnRlbmNlcz0xMFwiIDsgLy8gd3BwYWdlIG9ubHlcbiAgICByID0gXCImcmVkaXJlY3RzJmNvbnZlcnR0aXRsZXNcIiA7IC8vIHdwcGFnZSBvbmx5XG4gICAgYyA9IFwiJmNhbGxiYWNrPT9cIiA7Ly8gd2R8d3BcbiAgICBmID0gXCImZm9ybWF0PWpzb25cIiA7Ly8gd2R8d3BcblxuICAgIGxldCBpbnB1dCA9IGlucHV0RGF0YTtcbiAgICBsZXQgZmluYWxSID0gXCJcIjtcblxuICAgIC8vMWIuIENvbXBvc2UgeW91ciB1cmw6XG4gICAgdXJsd2QgPSB3ZCthdyt0cyt0K2krbCtwcyAgICArYytmOyAvLyB0eXBpY2FsIHdkIHF1ZXJ5XG4gICAgdXJsd3AgICA9IHdwK2FxICAgK3QraSAgICAgK3ArcitjK2Y7IC8vIHR5cGljYWwgd3AgcXVlcnlcbiAgICAvLyBFeGFtcGxlcyBwcmludCBpbiBjb25zb2xlOlxuICAgIC8vIGNvbnNvbGUubG9nKFwiMS4gV0Q6IFwiK3VybHdkKTtcbiAgICAvLyBjb25zb2xlLmxvZyhcIjIuIFdQOiBcIit1cmx3cCk7XG5cbiAgICAvKiB0cmFuc2xhdGUgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cbiAgICAvLyB2YXIgd2lraWRhdGFfdHJhbnNsYXRlID0gZnVuY3Rpb24gKGl0ZW0saXNvbGFuZykge1xuICAgIC8vICAgICB2YXIgdXJsID0gd2QrYXcrdHMrdCtpdGVtK2wrcHMgICAgK2MrZiwgLy8gdHlwaWNhbCB3ZCBxdWVyeVxuICAgIC8vICAgICAgICAgaXNvID0gaXNvbGFuZytcIndpa2lcIixcbiAgICAvLyAgICAgICAgIHRyYWQ9XCJcIjtcbiAgICAvLyAgICAgY29uc29sZS5sb2codXJsKTtcbiAgICAvLyAgICAgJC5nZXRKU09OKHVybCwgZnVuY3Rpb24gKGpzb24pIHtcbiAgICAvLyAgICAgICAgIHRyYWQgPSAganNvbi5lbnRpdGllc1sgT2JqZWN0LmtleXMoanNvbi5lbnRpdGllcylbMF0gXS5zaXRlbGlua3NbaXNvXS50aXRsZTtcbiAgICAvLyAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIjFcIit0cmFkKTtcbiAgICAvLyAgICAgfSlcbiAgICAvLyAvL3JldHVybiB0cmFkICtcInkyXCIrdG90bztcbiAgICAvLyB9O1xuICAgIC8vIGNvbnNvbGUubG9nKHdpa2lkYXRhX3RyYW5zbGF0ZShcIkRyYWdvblwiLCBcInpoXCIpIC8qKi8pXG5cbiAgICAvLzFjLiBET00gaW5qZWN0aW9uOlxuICAgIC8vJChcImJvZHlcIikuaHRtbCgnPGEgaHJlZj1cIicrdXJsKydcIj5MaW5rPC9hPi48YnIgLz4nKyB1cmwpOyAvL3B1Ymxpc2ggdGhlIHVybC5cbiAgICAvLyB3ZCtpIElOY29uc2lzdGVudGx5IHByb3ZpZGUgdmFyaWFudHMuXG5cbiAgICAvKiBERU1PICMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjICovXG4gICAgLyogMi4gVEVNUExBVElORyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuICAgIC8vIDJhLiBTaW5nbGUgcXVlcnkgOlxuICAgIGZ1bmN0aW9uIFdQKGl0ZW0pIHtcbiAgICAgICAgdXJsICAgPSB3cCthcSt0KyBpdGVtICtwK3IrYytmOyAgY29uc29sZS5sb2codXJsKTtcbiAgICAgICAgJC5nZXRKU09OKHVybCwgZnVuY3Rpb24gKGpzb24pIHtcbiAgICAgICAgICAgIHZhciBpdGVtX2lkID0gT2JqZWN0LmtleXMoanNvbi5xdWVyeS5wYWdlcylbMF07IC8vIFRISVMgRE8gVEhFIFRSSUNLICFcbiAgICAgICAgICAgIHZhciBleHRyYWN0ID0ganNvbi5xdWVyeS5wYWdlc1tpdGVtX2lkXS5leHRyYWN0O1xuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IFwiPGI+RW4gOjwvYj4gPHQ+XCIgKyBpdGVtICsgXCI8L3Q+IDxiPuKHkjwvYj4gXCIgKyBleHRyYWN0O1xuICAgICAgICAgICAgLy8gJCgnI2FuY2hvcjEnKS5hcHBlbmQoXCI8ZGl2PlwiK3Jlc3VsdCtcIjwvZGl2PlwiKTsgLy8gYXBwZW5kXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhyZXN1bHQpO1xuICAgICAgICAgICAgZmluYWxSID0gcmVzdWx0O1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGZpbmFsUik7XG4gICAgICAgIH0pO1xuICAgIH07IFxuICAgIFdQKGlucHV0KTtcblxuXG59O1xuXG5cbiJdfQ==

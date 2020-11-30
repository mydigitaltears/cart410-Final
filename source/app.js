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

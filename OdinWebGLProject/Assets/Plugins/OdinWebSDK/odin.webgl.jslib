var LibraryOdin = {
  $OdinCallbacks: {},
  $OdinSettings: {
    serverAddress: "gateway.odin.4players.io",
    userId: "Test User",
    roomId: "Test Room",
  },
  // this object contains convenience functions to interact with the Odin websdk
  $OdinFunctions: {
    // Fetches a token from the supplied end point. This is a sample implementation, you can use your own token generation.
    // If you change the endpoint to your own token generator, use an empty or "default" value as the "customer" parameter.
    fetchToken: async function (roomName, userId) {
      try {
        const response = await fetch(
          "https://app-server.odin.4players.io/v1/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              roomId: roomName,
              userId: userId,
              customer: "test",
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        return data.token;
      } catch (error) {
        console.error("Error fetching token:", error);
        throw error;
      }
    },
    // This function initializes the Odin client, connects to the room and starts the microphone input
    connect: async function (token) {
      console.log("Connect is being called with token " + token);
      try {
        // Create an audio context (must happen after user interaction due to browser privacy features)
        const audioContext = new AudioContext();

        // Authenticate and initialize the room
        const odinRoom = await OdinClient.initRoom(
          token,
          OdinSettings.serverAddress,
          audioContext
        );

        // Register room events
        this.handleRoomEvents(odinRoom);

        // Join the room and specify initial user data
        const ownPeer = await odinRoom.join();

        // Create a new audio stream for the default capture device and append it to the room
        navigator.mediaDevices
          .getUserMedia({
            audio: {
              echoCancellation: true,
              autoGainControl: true,
              noiseSuppression: true,
              sampleRate: 48000,
            },
          })
          .then((mediaStream) => {
            odinRoom.createMedia(mediaStream);
          });
      } catch (e) {
        console.error("Failed to join room", e);
        this.disconnect();
        alert(e);
      }
    },
    // This function disconnects the Odin client
    disconnect: function () {
      OdinClient.disconnect();
    },
    // This function registers the room events. You can use this to update your UI.
    handleRoomEvents: function (room) {
      room.addEventListener("ConnectionStateChanged", (event) => {
        console.log("Client connection status changed", event.payload.newState);

        OdinFunctions.dispatchUnityEvent(
          "ConnectionStateChanged",
          event.payload.newState
        );
      });

      // Handle peer join events to update our UI
      room.addEventListener("PeerJoined", (event) => {
        console.log(`Adding peer ${event.payload.peer.id}`);
        OdinFunctions.dispatchUnityEvent(
          "PeerJoined",
          event.payload.peer.id
        );
      });

      // Handle peer left events to update our UI
      room.addEventListener("PeerLeft", (event) => {
        console.log(`Removing peer ${event.payload.peer.id}`);
        OdinFunctions.dispatchUnityEvent(
          "PeerLeft",
          event.payload.peer.id
        );
      });

      // Handle media started events to update our UI and start the audio decoder
      room.addEventListener("MediaStarted", (event) => {
        console.log(
          `Adding new media ${event.payload.media.id} owned by peer ${event.payload.peer.id}`
        );
        event.payload.media.start();
      });

      // Handle media stopped events to update our UI and stop the audio decoder
      room.addEventListener("MediaStopped", (event) => {
        console.log(
          `Removing new media ${event.payload.media.id} owned by peer ${event.payload.peer.id}`
        );
        event.payload.media.stop();
      });

      // Handle media stopped events to update our UI and stop the audio decoder
      room.addEventListener("MediaActivity", (event) => {
        console.log(
          `Handle activity update for peer ${event.payload.peer.id}`,
          event.payload.media.active
        );

        // This is just a sample of how to dispatch an event to Unity. You can use this to update your UI.
        // The event payload contains more information about the peer, room and media connected to the event
        // You can adjust this to your needs, you'll only have to parse the JSON in C# correctly.
        OdinFunctions.dispatchUnityEvent(
          "MediaActivity",
          JSON.stringify({
            peerId: event.payload.peer.id,
            active: event.payload.media.active,
          })
        );
      });
    },
    // This function dispatches an event to Unity. It is used to update the UI.
    dispatchUnityEvent: function (eventName, payload) {
      // we get access from the script.onload function in the index.html
      if (OdinCallbacks[eventName])
        myGameInstance.SendMessage(
          OdinCallbacks[eventName].object,
          OdinCallbacks[eventName].function,
          payload
        );
    },
  },

  // This function is called from Unity to start the Odin client
  StartOdin: async function (roomIdUtf8, userIdUtf8) {
    OdinSettings.roomId = UTF8ToString(roomIdUtf8);
    OdinSettings.userId = UTF8ToString(userIdUtf8);
    console.log(
      "Using Room ID: " +
        OdinSettings.roomId +
        ", User ID: " +
        OdinSettings.userId
    );

    try {
      var token = await OdinFunctions.fetchToken(
        OdinSettings.roomId,
        OdinSettings.userId
      );
      console.log("Retrieved Token: " + token);
      await OdinFunctions.connect(token);
      OdinFunctions.dispatchUnityEvent("Connected", "true");
    } catch (e) {
      console.log("Error generating token" + e);
      alert(e);
      OdinFunctions.dispatchUnityEvent("Connected", "false");
    }
  },
  // used to register callback functions. Functions will be dispatched to Unity when an ODIN event occurs.
  AddCallback: function (callbackType, callbackObject, callbackFunction) {
    var callbackTypeString = UTF8ToString(callbackType);
    var callbackFunctionString = UTF8ToString(callbackFunction);
    var callbackObjectString = UTF8ToString(callbackObject);
    OdinCallbacks[callbackTypeString] = {
      object: callbackObjectString,
      function: callbackFunctionString,
    };
  },
  DisconnectOdin: function () {
    OdinFunctions.disconnect();
  },
};

autoAddDeps(LibraryOdin, "$OdinSettings");
autoAddDeps(LibraryOdin, "$OdinCallbacks");
autoAddDeps(LibraryOdin, "$OdinFunctions");
mergeInto(LibraryManager.library, LibraryOdin);

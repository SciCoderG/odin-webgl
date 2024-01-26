using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using AOT;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class OdinWebSDKBridge : MonoBehaviour
{
   
    
    [Header("Odin Room Settings")]
    [SerializeField] private string roomId = "WebGLTest";
    [SerializeField] private string userId = "Test User";
    
    [Header("Display References")]
    [SerializeField] private Button connectButton;
    [SerializeField] private TMP_Text statusText;
    [SerializeField] private TMP_Text peerSendingDisplay;

    private readonly Dictionary<int, bool> _peerSendingState = new Dictionary<int, bool>();

    private StringBuilder _peerListStringBuilder = new StringBuilder();

    /// <summary>
    /// Calls StartOdin defined in odin.webgl.jslib
    /// </summary>
    /// <param name="roomId">name of Odin room to enter</param>
    /// <param name="userId">User Id that enters</param>
    [DllImport("__Internal")]
    private static extern void StartOdin(string roomId, string userId);

    /// <summary>
    /// Disconnect from Odin
    /// </summary>
    [DllImport("__Internal")]
    private static extern void DisconnectOdin();

    /// <summary>
    /// Register a callback function. The odin web sdk will call the function with name `callbackFunctionName` on
    /// the gameObject `callbackObjectName` when an event with name `eventType` is dispatched.
    /// Take a look at the odin.webgl.jslib for the available events.
    /// </summary>
    /// <param name="eventType">The event type to listen to</param>
    /// <param name="callbackObjectName">The name of the game object on which the callback function will be invoked</param>
    /// <param name="callbackFunctionName">The name of the invoked callback funciton</param>
    [DllImport("__Internal")]
    private static extern void AddCallback(string eventType, string callbackObjectName, string callbackFunctionName);

    private void Start()
    {
        connectButton.onClick.AddListener(StartOdin);
    }

    /// <summary>
    /// Registers callbacks and connects to Odin room
    /// </summary>
    public void StartOdin()
        {
            AddCallback("Connected", "OnConnected");
            AddCallback("ConnectionStateChanged", "OnConnectionStateChanged");
            AddCallback("PeerJoined", "OnPeerJoined");
            AddCallback("PeerLeft", "OnPeerLeft");
            AddCallback("MediaActivity", "OnMediaActivity");
            StartOdin(roomId, userId);
            connectButton.interactable = false;
            TMP_Text buttonText = connectButton.GetComponentInChildren<TMP_Text>();
            if (buttonText)
            {
                buttonText.text = "Connecting...";
            }
        }

        /// <summary>
        /// Shortcut for adding a callback to the jslib. Provides the current gameObject's name as the callback object name.
        /// </summary>
        /// <param name="eventType">Event Type to add callback for</param>
        /// <param name="callbackFunctionName">Name of the callback Function</param>
        private void AddCallback(string eventType, string callbackFunctionName)
        {
            AddCallback(eventType, gameObject.name, callbackFunctionName);
        }
    
        private void OnDestroy()
        {
            DisconnectOdin();
        }
    
        /// <summary>
        /// Disconnect from Odin and reset the UI and peer list
        /// </summary>
        private void Disconnect()
        {
            DisconnectOdin();
            connectButton.interactable = true;
            TMP_Text buttonText = connectButton.GetComponentInChildren<TMP_Text>();
            if (buttonText)
            {
                buttonText.text = "Reconnect";
            }
            connectButton.onClick.RemoveAllListeners();
            connectButton.onClick.AddListener(StartOdin);
            _peerSendingState.Clear();
            UpdatePeerListDisplay();
        }

        
        private void UpdatePeerListDisplay()
        {
            foreach (var (peerId, isSending) in _peerSendingState)
            {
                _peerListStringBuilder.AppendLine($"Peer {peerId} connected, is sending: {isSending}");
            }

            peerSendingDisplay.text = _peerListStringBuilder.ToString();
            _peerListStringBuilder.Clear();
        }
    
    #region Callbacks
    public void OnConnected(string success)
    {
        bool isSuccess = "true" == success;
        TMP_Text buttonText = connectButton.GetComponentInChildren<TMP_Text>();
        if (isSuccess)
        {
            connectButton.interactable = true;
            if (buttonText)
            {
                buttonText.text = "Disconnect";
            }
            connectButton.onClick.RemoveAllListeners();
            connectButton.onClick.AddListener(Disconnect);
        }
        else
        {
            connectButton.interactable = true;
            if (buttonText)
            {
                buttonText.text = "Try to Reconnect";
            }
        }
    }

    public void OnConnectionStateChanged(string newState)
    {
        statusText.text = $"Connection State: {newState}";
    }

    public void OnPeerJoined(int peerId)
    {
        _peerSendingState[peerId] = false;
        UpdatePeerListDisplay();
    }
    
    public void OnPeerLeft(int peerId)
    {
        _peerSendingState.Remove(peerId);
        UpdatePeerListDisplay();
    }

    /// <summary>
    /// Take a look at the MediaActivity event dispatch in the odin.webgl.jslib sample for more info on how the `MediaActivityData`
    /// is encoded and sent to Unity. 
    /// </summary>
    /// <param name="data">JSON object sent from javascript lib</param>
    public void OnMediaActivity(string data)
    {
        MediaActivityData mediaActivityData = JsonUtility.FromJson<MediaActivityData>(data);
        _peerSendingState[mediaActivityData.peerId] = mediaActivityData.active;
        UpdatePeerListDisplay();
    }
    
    private struct MediaActivityData
    {
        public int peerId;
        public bool active;
    }
    #endregion

   

    
}
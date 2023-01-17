/**
* AlexaHost is a Play Canvas scriptType designed to initialize
* and then channel Alexa functionality to a Play Canvas game using
* the Alexa Web API for Games feature. https://developer.amazon.com/en-US/docs/alexa/web-api-for-games/alexa-games-about.html
*
* To communicate with the rest of the Play Canvas game, this host will publish 
and listen to events registered with the pc global.
*
* Events fired:
* * alexaMessage(msg) - fired when a message is received from the skill, and it is not handled by one fo the more specific events
* * alexaIntent(msg) - fired when a message is received containing an ASK Intent Request
* * alexaPersistenceUpdated(data) - fired whenever the persistence data object was changed on the cloud, including at least once when the connection to the skill is first established.
* 
* Events listened to:
* * alexaUpdatePersistence(data) - replace this player's persistent data with the given object. 
*/
var AlexaHost = pc.createScript("AlexaHost");

AlexaHost.attributes.add('echoDebugToConsole', { type: 'boolean', default: true });

/// <reference path="./alexaSDK.d.ts"/>

AlexaHost.prototype.initialize = function () {
  /** @member {Alexa.AlexaClient} alexaClient is an instantiated version of the Alexa SDK */
  this.alexaClient = null;
  
  /** @member {boolean} supportsWakeword whether this device supports a wakeword. May be false on Alexa enable devices that require a button push to talk, e.g. the Fire TV Stick */ 
  this.supportsWakeword = true;

  /** @member {string} wakeWord when supported, which specific wakeword this device recognizes, e.g. 'Alexa', 'Echo', 'Computer', etc */
  this.wakeWord = "Alexa";

  // register events, we do this even when Alexa isn't present,
  // so that game code that relies on it doesn't crash while we're
  // iterating
  pc.app.on("promptAlexa", (speech) => this.prompt(speech));
  
  // if we're iterating on a PC, we can skip trying to contact Alexa
  const runningInLaunch = window.location.href.indexOf("launch.playcanvas.com") >= 0;
  if (runningInLaunch) {
    this.pushDebug('Not running on device, not initializing Alexa');
    return;
  }
  
  try {
    this.pushDebug("Starting Alexa initialization");
    Alexa.create({ version: "1.1" })
    .then((args) => {
      
      if ('alexa' in args) {
        let alexa = args.alexa;
        this.alexaClient = alexa;
        this.pushDebug( `Alexa is ready :) Received initial data: ${JSON.stringify(args.message)}` );
        
        // hook up the message receiver
        alexa.skill.onMessage((msg) =>
          this.onMessageReceived(msg)
        );
        
        // store this on this entity for convenient access 
        if ( alexa.capabilities && alexa.capabilities.microphone ) {
          this.supportsWakeWord = alexa.capabilities.microphone.supportsWakeWord;
        }
          
        // process any startup data we sent ourselves
        if (args.message) {
          this.onMessageReceived(args.message);
          try {
            // this is the mechanism for discovering which wakeword is active
            // by sending ourselves a string that we process with the hint transformer
            if (args.message.hint) {
              const match = /try\s+\"(\w*),/gi.exec( args.message.hint );
              if (match) {
                this.pushDebug( `discovered wake word: ${match[1]}` );
                this.wakeWord = match[1];
              }
            }
          } catch (err) {
            console.error(err);
            this.wakeWord = "Alexa";
          }
        }
        
      } else {
        // something went wrong with initialization, Alexa services won't be available
        this.pushDebug( `Alexa did not return a client object, code: ${args.code}` );
      }
      
    })
    .catch((err) => {
      // something went wrong during initialization, the service may be down?
      this.pushDebug( `Alexa failed to create :( reason: ${err}` );
    });
  } catch (err) {
    // the Alexa global didn't exist or didn't work as expected, did the script even load?
    console.error(err);
    this.pushDebug(`Alexa initialization failed: ${err}`);
  }
};

/**
 * If a text element is present on this entity, then this will write
 * debug messages to it, letting developers easily see these on device
 * If this.echoDebugToConsole is true, messages are also written to console
 * @param {*} txt string to display in debug contexts 
 */
AlexaHost.prototype.pushDebug = function (txt) {
  if ( this.echoDebugToConsole ) {
    console.log(txt);
  }
  
  if ( this.entity.element ) {
    // these come infrequently enough that it's usually contextually useful
    // enough to show just the latest one. If you need more history, it's
    // best to lean on the console instead. Note: You can use Android adb to 
    // get Chrome remote inspector access on Fire TV devices!
    if (typeof txt === "string") {
      this.entity.element.text = txt;
    } else {
      this.entity.element.text = JSON.stringify(txt, null, 2);
    }
  }
};

/**
 * A convenience function for testing intent based functionality.
 * For example, in a browser debugger you could type:
 *   a = pc.root.findComponent('AlexaHost')
 *   a.spoof('BuyIntent', {type: 'sword', count: 1})
 * @param {string} intent 
 * @param {Object.<string, string[]>} slots 
 */
AlexaHost.prototype.spoof = function (intent, slots) {
  let msg = { intent: intent, slots: {} };

  // for convenience, accept single values and non strings 
  // like numbers for slot arguments, but convert them to 
  // the array of string values we'd expect form a real intent
  for (let name in slots) {
    let values = slots[name];
    if ( Array.isArray(values) ) {
      msg.slots[name] = values.map( v => '' + v );
    } else {
      msg.slots[name] = [ '' + values ];
    }
  }
  
  // we're not going to spoof the full request object, just
  // pass on the parsed form
  pc.app.fire('alexaIntent', msg);
};

/**
 * Process messages received from the skill endpoint
 * @param {*} msg 
 */
AlexaHost.prototype.onMessageReceived = function (msg) {
  if ( this.echoDebugToConsole ) {
    console.log(`received Alexa message:`);
    console.log(msg);
  }  
  
  if (msg.request) {
    // request types, forwarded from most ASK Requests
    switch (msg.request.type) {
      case "IntentRequest":
        let parsed = { intent: '', slots: {} };
        let intent = msg.request.intent;
        
        // the intent we'll pass on is just the name
        parsed.intent = intent.name;
        
        // if there are slots, collect any potential variations
        if (intent.slots) {
          let slots = intent.slots;
          for (let k in slots) {
            let slot = slots[k];
            parsed.slots[k] = [];

            // add the base value, if one is recognized
            if (slot.value) {
              parsed.slots[k].push(slot.value);
            }

            // walk through each resolver, usually static and 
            // possibly also a dynamic one, collecting every hypothesis
            if ( slot.resolutions && slot.resolutions.resolutionsPerAuthority ) {
              for (let auth of slot.resolutions.resolutionsPerAuthority) {
                if (auth.values) {
                  for (let val of auth.values) {
                    // just tack them on. These should be in order of 
                    // confidence, but in most cases we'll just want to 
                    // see if any of our expected values are in these lists
                    parsed.slots[k].push(val.value.name);
                  }
                }
              }
            }
          }
        }
        // log to screen the parsed info without the more verbose full request
        this.pushDebug(parsed);
        // but pass on the full request in case someone needs it
        parsed.request = msg.request;
        pc.app.fire('alexaIntent', parsed);
        break;
    } 
  } else {
    this.pushDebug(`received: ${JSON.stringify(msg,null,2)}`);
  }

  // generically, also pass the raw message to anyone who may want it
  // this is useful if you've modified the skill endpoint to emit arbitrary
  // new things in the message.
  pc.app.fire("alexaMessage", msg);
};

AlexaHost.prototype.prompt = function (speech) {
  this.sendMessage({ prompt: speech });
};
  
AlexaHost.prototype.messageSentCallback = function (result, msg) {
  if (result.statusCode === 200) {
    //console.log(`message was sent to backend successfully: ${JSON.stringify(msg)}`);
  } else {
    this.pushDebug( `failed to send message to skill backend: ${JSON.stringify(msg)}` );
  }
};
  
AlexaHost.prototype.sendMessage = function (msg) {
  if (this.alexaClient) {
    console.log(`sending message ${msg}`);
    this.alexaClient.skill.sendMessage(msg, (r) =>
    this.messageSentCallback(r, msg)
    );
  } else {
    if (startedInLaunch()) {
      console.log(`would send ${JSON.stringify(msg)}`);
    } else {
      console.error( `Alexa was not ready, could not send message: ${JSON.stringify(msg)}`);
    }
  }
};
    
/**
 * Called when this script is reloaded by the engine during development
 * @param {AlexaHost} old 
 */
AlexaHost.prototype.swap = function (old) {
  // note: you can only initialize Alexa communication once per session,
  // so we cannot call initialize again here.
  this.alexaClient = old.alexaClient;
  this.wakeWord = old.wakeWord;
  this.supportsWakeWord = old.supportsWakeWord;
  console.log("reloaded AlexaHost script");
};

/**
*
* @param {string[]} slotValues either a single string, or an array of alternates
* @returns either a single number derived from the first compatible string, or undefined if none such exists
*/
function alexaNumberFromSlotValue(slotValues) {
  if (typeof slotValues === "string") {
    let val = parseInt(slotValues);
    if (isNaN(val)) {
      return undefined;
    }
    return val;
  }
  
  if (Array.isArray(slotValues)) {
    for (let sv of slotValues) {
      let val = parseInt(sv);
      if (!isNaN(val)) {
        return val;
      }
    }
  }
  
  return undefined;
}


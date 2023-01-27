# Alexa + Play Canvas

[Play Canvas](playcanva.as) is an open source HTML5 game engine, paired with an online editor and hosting service, providing a comprehensive and delightful way to create and distribute HTML5 games.

[Alexa](https://www.amazon.com/gp/browse.html?node=21576558011) is a digital personal assistant that runs on a large variety of hardware, including the Echo and Fire TV line of Amazon devices. [Alexa Skills](https://www.amazon.com/gp/browse.html?node=13727921011) is a mechanism to expand Alexa's capabilities, freely available to developers. Alexa customers can enable and pay for new skills in the Alexa Skill Store. Alexa enabled devices with screens, support running skills that in turn [launch an HTML5 game](https://developer.amazon.com/en-US/docs/alexa/web-api-for-games/alexa-games-about.html) on the device, automatically granting the game access to the wide range of Alexa skill features. 

This repository contains a variety of components that are useful when constructing an Alexa game using Play Canvas. To create a working game, you'll need to construct both an Alexa skill and a Play Canvas game, and then connect them together. There are a number of ways to do this, but the shortest path to tinkering is:
1. Log into the [Amazon developer portal](https://developer.amazon.com) with your Amazon account, and then create a free new Alexa Hostes Skill specifying this repo as a template in the creation wizard. Enabling testing on the skill will automatically make it available on any of your devices.
1. Create an account at [Play Canvas](https://playcanvas.com/), and then follow the instructions below to fork the sample game.
1. Modify the code in your new Alexa skill to point to your new game's URL.
1. Start tinkering!


## Play Canvas code - ./playcanvas/alexaHost.js

This drop-in file defines a Play Canvas compatible implementation for communicating with an Alexa skill endpoint, as well as a few related utility functions. A [Sample Game](https://playcanvas.com/project/1028598) demonstrates its use, and can be forked to start a new project.

To use the AlexaHost from scratch instead, create a new Play Canvas game and then:
1. In the project settings, add an [External Script](https://developer.playcanvas.com/en/user-manual/designer/settings/#external-scripts) reference to the Alexa [JavaScript API CDN](https://developer.amazon.com/en-US/docs/alexa/web-api-for-games/alexa-games-build-your-webapp.html#add-the-alexa-javascript-library-to-your-app).
1. Add the `alexaHost.js` script from this repo[ to your project.](https://developer.playcanvas.com/en/user-manual/designer/assets/#creating-and-uploading-assets)
1. Create a new Entity, add a [Script Component](https://developer.playcanvas.com/en/user-manual/scripting/) to it, and then add the `AlexaHost` scripted type to that. Note: be careful to have only exactly one instance of this script.
1. [optional] Add a [Sound Component](https://developer.playcanvas.com/en/user-manual/packs/components/sound/) to the same entity if you'd like to play text to speech material converted through Alexa. You can adjust the volume on this component in the usual way, to mix that audio with the rest of your game.
1. [optional] Add a [Text Element Component](https://developer.playcanvas.com/en/user-manual/packs/components/element/#text-element) to the same entity and adjust its display. When present and enabled, the Alexa script will use this to display debugging information on screen.

On `initialize`, the alexaHost script component will use the Alexa JS SDK to establish a connection back to the skill endpoint that launched it. After this succeeds, the component acts as the hub for Alexa related functionality described below.


## Alexa code - ./alexa/skill/index.js

This file is a node.js entry point to an Alexa skill endpoint, that is designed to launch a given Play Canvas game, and then manage communication with it, acting as a bridge to access Alexa features. It comes ready to support a range of features out of the box, and you can use it as the basis for further customization and development. It is formatted for deployment as an [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) function, which you would then [provide to your skill](https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-an-aws-lambda-function.html).

The repo directory is laid out in the format required by the [Alexa command line tool](https://developer.amazon.com/en-US/docs/alexa/smapi/ask-cli-intro.html), which you can use to deploy this project as a new skill into your Amazon developer account. The project will use AWS CloudFormation to create a Lambda function, DynamoDB database, and S3 bucket in your AWS account, to serve as the skill's infrastructure.

Alternatively, you may want to try [Alexa Hosted Skills](https://developer.amazon.com/en-US/docs/alexa/hosted-skills/build-a-skill-end-to-end-using-an-alexa-hosted-skill.html). Hosted Skills provides free basic infrastructure resources for skills in a fixed format that may meet your needs. Should you outgrow these basic resources, or decide that you would like to leverage other cloud side AWS features, you can port your endpoint to custom infrastructure later, and then redirect your Alexa Skill to use that instead. Should you opt to use a Hosted Skill, you can use this repo's git URL directly as a template in the Hosted Skills creation wizard.

Whichever way you deploy this skill endpoint code, it ships with a reference to the sample Play Canvas game mentioned above. This is defined at the top of the JavaScript file as the variable `const PlayCanvasGameURL = "https://playcanv.as/e/p/XT3LYsQ7/";` Once you confirm the skill has been deployed successfully, you'll want to change this to point to your own Play Canvas game. Carefully note the `/e/` portion of the URL as opposed to the default URL that Play Canvas generates in most contexts; this produces an HTML page that does not rely on an iFrame to contain the game, which would interfere with Alexa connectivity.


## Communication between Alexa Skill endpoint and Play Canvas game - Messages
Messages are JSON objects sent by the skill endpoint to the HTML5 game's JavaScript environment, via the Alexa Web API for Games [`HandleMessage` directive](https://developer.amazon.com/en-US/docs/alexa/web-api-for-games/alexa-presentation-html-interface.html#handle). In this integration, these are all uniformly raised by the alexaHost script as an `alexaMessage` event on the Play Canvas `app` object. You can listen to these from any other Play Canvas script to react to Alexa messages. The event has a single argument, the message received.

```JavaScript
MyScriptedType.protoype.initialize = function() {
  this.app.on('alexaMessage', (message) => {
    // handle message here
  });
}
```

In the general case, messages that originate from an [Alexa skill request](https://developer.amazon.com/en-US/docs/alexa/custom-skills/request-and-response-json-reference.html) will have a `request` member with a full copy of the original request. The provided skill code passes most relevant request types down to the Play Canvas game. You can extend your skill endpoint code to send new kinds of messages. 

The skill endpoint code included in this integration also uses this mechanism to provide some canned services, as described below. Where appropriate, a more focused event will also be raised on the `app` object as well as the general one described above.

The Alexa Web API also allows the web app to send messages to the skill endpoint. This is exposed on `app` as a `alexaSendMessage` event, which takes a single argument, the JSON object to send to the skill endpoint. The out of the box features described below will also format and send messages using this mechanism


## Voice Input - Intents
As a skill developer, you'll teach Alexa what you expect your players to say (utterances) by creating a language model that specifies one or more [intents](https://developer.amazon.com/en-US/docs/alexa/custom-skills/create-the-interaction-model-for-your-skill.html). In brief: using the Alexa tools, either the online developer portal, or offline using the Alexa CLI, you will define all the alternative ways your player could specify the intent, as well as define slots for parts of speech that will be variable. For instance to purchase items, you might define a `PurchaseItems` intent, specifying `Amount` and `Type` slots, and at least one sample utterance like, *"I'd like to buy {Amount} {Item}"*, which might match your player saying, *"I'd like to buy 3 potions please."* At runtime, any recognized intent will be delivered to your skill endpoint as a JSON object in an Intent Request.

This integration recognizes an incoming Intent Request and raises an `alexaIntent` on the Play Canvas `app` object, with a simplified but opinionated view of the contents. It comes with a single argument with the following properties:
* `name`, the token name for the intent as defined in your language model, e.g. `PurchaseItems` in the above example.
* `slots`, a flattened map of all slots recognized in the intent, which may be a subset of all defined slots. Each slot is an array of possible recognized string values, sorted as follows:
  * [if available] dynamic authority values, most to least certain
  * static authority values, most to least certain
  * the root recognized value
* `request`, contains the full original Alexa request object
* `numberFromSlot`, a function to try and convert any of the recognized slots into a number
   
All slot values are presented as strings, even if the slot type you've defined is a number. Because of the ambiguities of human speech and the potential breadth of your language model, it is also possible that slots may contain values outside of your initial specification. For example: if you have an intent that refers to character names in your game, e.g. `SendMessage`, with the sample utterance *"send a message to {Character}"*, and you define `Character` as `["Abby", "Bob"]`, if your player then says, *"send a message to Jeremy"*, Alexa may be confident enough that it's clear the player wants the `SendMessage` intent, and will do its best to fill in `Character`, potentially accurately transcribing the value `Jeremy` into the slot.

To work with numbers, the `alexaHost.js` script provides a global `alexaNumberFromSlotValue` function. It will extract a number from the given slot values if possible, or return undefined. As noted above, when processing an `alexaIntent` event, this function is available directly on the event argument.

Here's an example of listening for the PurchaseItems intent we mentioned above:

```JavaScript
var Store = pc.createScript('Store');

Store.prototype.initialize = function() {
  pc.app.on('alexaIntent', this.onAlexaMessage, this);
}

Store.prototype.onAlexaMessage = function(intent) {
  switch( intent.name ) {
    case "PurchaseItems":
      const itemType = intent.slots.Type;
      const itemCount = intent.numberFromSlot('Amount');
      if ( !validateItemType(itemType) ) {
        // Because your player may say anything, you must consider
        // the possibility they say something not specified in your
        // language model.
        // Indicate to the player that they have specified an item 
        // type that doesn't exist; maybe ask again, or display a 
        // list of valid choices, whatever makes sense in the context
        return;
      }
      
      if ( itemCount === undefined ) {
        // As above, it's possible the player said something that 
        // doesn't make sense here.
        // Indicate to the player that they have specified an invalid
        // amount, try again.
        return;
      }
      
      // do purchasing
      break;
  }  
}
```

## Monetization 

Alexa skills can monetize their services in [a number of different ways](https://developer.amazon.com/en-US/docs/alexa/custom-skills/sell-products-in-an-alexa-skill.html) including: one time purchases, consumable purchases, and subscriptions. To support them in your game, you'll need to implement two things: entitlements and purchases. 

### Entitlements
Alexa skills are always available to customer to enable and launch, so to charge for your content, you'll want to lock portions of your game behind a player purchase; Alexa calls this an entitlement. In your game code, you'll check to see whether a player has a given entitlement you define, and then enable or disable some functionality. To do this, you'll:
1. Set up your Alexa [In-Skill Purchase Products](https://developer.amazon.com/en-US/docs/alexa/in-skill-purchase/create-isp-dev-console.html)
2. When AlexaHost first establishes contact with your skill endpoint, it'll receive a flat list of all of the current player's entitlements in the form of [InSkillProduct](https://developer.amazon.com/en-US/docs/alexa/in-skill-purchase/in-skill-product-service.html#inskillproducts) objects. You can listen to the `alexaConnected` event on the Play Canvas `app` object, and find these in the `products` member of its argument. 

Here's an example where you might offer different levels to play based on whether the player has purchased expansion packs.

```JavaScript
// Assuming we have a scriptType that control access to levels
var LevelsMenu = pc.createScript('LevelsMenu');

LevelsMenu.prototype.initialize = function() {
  // Imaginine this is an array of level objects that can be 
  // enabled or disabled. They might be child entities with elements 
  // representing GUI options.
  // You'll want to set all paid content to disabled to start with,
  // you'll turn it on later in the entitlement check.
  this.levels = [ /* level data */ ];
  this.levels.forEach( l => l.enabled = false )

  pc.app.on('alexaConnected', this.onAlexaConnected, this);
}

LevelsMenu.prototype.onAlexaConnected = function(message) {
  // loop over each product
  for ( let p of message.products ) {
    // work out what the product applies to by using the referenceName
    // we set up in the Alexa developer portal
    switch ( p.referenceName ) {
      case 'LevelPackCastles': 
        for ( let level of this.levels ) {
          // in this case we're imagining that each level is tagged
          // with a property that tells us which level pack it belongs to
          if ( level.type === 'castle' ) {
            // because purchases can be refunded, or subscriptions 
            // cancelled, if you want to revoke access, be sure to always
            // synchronize to the latest state
            level.enabled = p.entitled === 'ENTITLED';
          }
        }
        break;
      case 'LevelPackDungeons': 
        for ( let level of this.levels ) {
          if ( level.pack === 'dungeon' ) {
            level.enabled = p.entitled === 'ENTITLED';
          }
        }
        break;
    }
  }
}
```

### Purchases
To offer your players the ability to purchase any of your products, you'll need to implement a purchasing flow. On Alexa devices, purchasing works by handing control over to the Alexa store, indicating which item the player is trying to purchase. The store will then have a conversation with the player, making sure they understand and authorize the purchase. 

You can build any sort of GUI you like in the game to show the player what's available. Once you determine they'd like to start a purchase, raise the `alexaStartPurchase` event on the Play Canvas `app`, specifying the productID they want to purchase. If the request is successful, your skill will be backgrounded, and Alexa will take over. When the purchase is either successful or cancelled, Alexa will then relaunch your skill, which will reboot the Play Canvas game. You can listen to the `alexaConnected` event as described above to react appropriately to any new entitlements your player bought.

Here's an example of how you might wire a button press to start a purchase:

```JavaScript
BuyButton.prototype.initialize = function() {
  this.entity.element.on('click', () => {
    // replace the product ID in the following function call with one of the product IDs you've defined back at the Amazon Developer Portal
    this.app.fire('alexaStartPurchase', "amzn1.adg.product.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });
}
```


## Saving player data - Persistence

To preserve you players' progress across sessions, you'll need to store some data on their behalf, somewhere on the cloud. Note: Alexa devices do not preserve any form of JavaScript local storage on device, including cookies. 

Every Alexa [skill request](https://developer.amazon.com/en-US/docs/alexa/custom-skills/request-and-response-json-reference.html#request-format) comes with two string IDs that can be useful keys here: the deviceId (the specific device in question) and the userId (roughly the Amazon account that is logged in). Both of these Ids are generated uniquely for your skill, so the same player and device will appear as two different Ids in two different skills. Which Id you choose to store your player data against depends on whether you want the information to be tied to the device or the user.

The skill backend defined here provides a basic implementation of using AWS DynamoDB to store your player data, and is configured to use the userId. DynamoDB is a cost effective way to store and manipulate a lot of very small data objects, i.e. ~16kb or so. If your needs remain modest, the AWS free tier can easily handle thousands of players without incurring any charges.

When your skill launches, the skill backend will pull the current state of this player's persistent data, and include that with the initial message it sends to launch the app. This message will be raised as an `alexaPersistenceUpdated` event on the global `pc` object. If this is a new player, the skill will initialize an empty {} object. Subsequently, whenever you want to update the save state, raise an `alexaUpdatePersistence` event with the new object you want to store. 

Because there's the possibility that the same player's account could be running on another device, and there's always the chance of messages going missing in transit, the persistent data in the database is protected by an [optimistic concurrency scheme](https://en.wikipedia.org/wiki/Optimistic_concurrency_control). To detect unintentional write conflicts, the data object is initialized with a `clock` parameter. You must include the same `clock` value when trying to write a new version of the object. In the event of a collision, an `alexaUpdatePersistenceFailed` will be raised event on `pc` that contains the actual current data object, which you can then reconcile before trying to `alexaUpdatePersistence` again. When an update succeeds you'll received an `alexaUpdatePersistenceSucceeded` event, with the new clock value for your next update.

Note: because an Alexa device may be called upon to perform other tasks at a moment's notice, your web game may be closed instantaneously, the way a player might close a browser tab, leaving your app no time to store state. It is likely that you'll want implement some degree of autosave functionality, so that players can jump in right back where they left off.

Put together, here's an example of a player scriptType that saves its state:

```JavaScript
// Assuming we have a scriptType that control access to levels
var Player = pc.createScript('Player');

Player.prototype.initialize = function() {
  // mark this null for now, so that we know we haven't received
  // the current state yet
  this.saveData = null;
  
  pc.app.on('alexaPersistenceUpdated', this.onAlexaPersistenceUpdated, this);
  pc.app.on('alexaUpdatePersistenceFailed', this.onAlexaUpdatePersistenceFailed, this);
  pc.app.on('alexaUpdatePersistenceSucceeded', this.onAlexaUpdatePersistenceSucceeded, this);
  
  this.hud = pc.root.findByName('hud');
}

Player.prototype.saveGame = function() {
  pc.app.fire('alexaUpdatePersistence', this.saveData);
}

Player.prototype.onAlexaPersistenceUpdated = function(data) {
  // Save this as the new state
  this.saveData = data;
  
  // Detect if this is a new data object, initialize if so.
  // Keep in mind that data comes with a `clock` property that
  // we have to preserve for writing later
  if ( data.health === undefined ) {
    data.health = 100;
  }
  
  // now update the game to reflect saved data
  this.hud.fire('setPlayerHealth', data.health);
}

Player.prototype.onAlexaUpdatePersistenceFailed = function(data) {
  // `data` has what's actually in the database, including the 
  // new `clock` value we need to use next time.
  // We can compare `this.saveData` and `data` to work out what we
  // think the new state should be, and apply that to to the 
  // current game.
  
  // whatever we decide, we have to adopt the new clock before 
  // our next update attempt.
  this.saveData.clock = data.clock;
  
  // If we think we have a new state, we can try writing that back.
  this.saveGame();
}

Player.prototype.onAlexaUpdatePersistenceSucceeded = function(clock) {
  // the update was successful, we can store the new clock for 
  // the next update attempt
  this.saveData.clock = data.clock;
}

  
```

## FAQs
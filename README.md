# Alexa + Play Canvas

[Play Canvas](playcanva.as) is an open source HTML5 game engine, paired with an online editor and hosting service, providing a comprehensive and delightful way to create and distribute HTML5 games.

[Alexa](https://www.amazon.com/gp/browse.html?node=21576558011) is a digital personal assistant that runs on a large variety of hardware, including the Echo and Fire TV line of Amazon devices. [Alexa Skills](https://www.amazon.com/gp/browse.html?node=13727921011) is a mechanism to expand Alexa's capabilities, freely available to developers. Alexa customers can enable and pay for new skills in the Alexa Skill Store. Alexa enabled devices with screens support running skills that in turn [launch an HTML5 game](https://developer.amazon.com/en-US/docs/alexa/web-api-for-games/alexa-games-about.html) on the device, automatically granting the game access to the wide range of Alexa skill features. 

This repository contains a variety of components that are useful when constructing an Alexa game using Play Canvas. To create a working game, you'll need to construct both an Alexa skill and a Play Canvas game, and then connect them together.

## Play Canvas code - ./playcanvas/alexaHost.js

This file defines a Play Canvas compatible implementation for communicating with an Alexa skill endpoint. The [Sample Game]() demonstrates its use.

To use it from scratch, create a new Play Canvas game and then:
1. In the project settings, add an [External Script](https://developer.playcanvas.com/en/user-manual/designer/settings/#external-scripts) reference to the Alexa [JavaScript API CDN](https://developer.amazon.com/en-US/docs/alexa/web-api-for-games/alexa-games-build-your-webapp.html#add-the-alexa-javascript-library-to-your-app).
1. [Add alexaHost.js](https://developer.playcanvas.com/en/user-manual/designer/assets/#creating-and-uploading-assets) to your project.
1. Create a new entity, add a [Script Component](https://developer.playcanvas.com/en/user-manual/scripting/) to it, and add the "alexaHost" script to it. Note: you should only have exactly one instance of this script.
1. [optional] Add a [Text Element Component](https://developer.playcanvas.com/en/user-manual/packs/components/element/#text-element) to the same entity and adjust its display. When present and enabled, the Alexa script will use this to display debugging information on screen.

On `initialize`, the alexaHost script component will use the Alexa JS SDK to establish a connection back to the skill endpoint that launched it. After this succeeds, the component acts as the hub for Alexa related functionality described below.

## Alexa code - ./alexa/skill/index.js

This file is a node.js entry point to an Alexa skill endpoint, that is designed to launch a given Play Canvas game, and then manage communication with it, acting as a bridge to access Alexa features. It comes ready to support a range of feature out of the box, and you can use it as the basis for further customization and development. It is formatted for deployment as an [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) function, which you would then [provide to your skill](https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-an-aws-lambda-function.html).

The `./alexa/` directory is laid out in the format required by the [Alexa command line tool](https://developer.amazon.com/en-US/docs/alexa/smapi/ask-cli-intro.html), which you can use to deploy this project as a new skill into your Amazon developer account. The project will use AWS CloudFormation to create a Lambda function, DynamoDB database, and S3 bucket in your AWS account, to serve as the skill's infrastructure.

Alternatively, you may want to try the [Alexa Hosted Skills](https://developer.amazon.com/en-US/docs/alexa/hosted-skills/build-a-skill-end-to-end-using-an-alexa-hosted-skill.html) product. Hosted Skills provides free basic infrastructure resources for skills in a fixed format that may meet your needs. Should you outgrow these basic resources, or decide that you would like to leverage other cloud side AWS features, you can port your infrastructure later and redirect your skill to use that instead. Should you opt to use a Hosted Skill, once you've created the empty basic template, just replace the contents of the generated `index.js` file with the one here at `./alexa/skill./index.js`.

TODO explain how to set URL, CRITICAL: remember to use the embeded form, add 'e' to the play URL: e.g. not, https://playcanv.as/p/XT3LYsQ7" but https://playcanv.as/e/p/XT3LYsQ7"

## Communication from the Skill - Messages
Messages are JSON objects sent by the skill end point to the Play Canvas game, via the Alexa Web API for Games [`HandleMessage` directive](https://developer.amazon.com/en-US/docs/alexa/web-api-for-games/alexa-presentation-html-interface.html#handle). These are all uniformly raised by the alexaHost script as an `alexaMessage` event on the global `pc` object. You can listen to these from any other Play Canvas script to react to Alexa messages. The event has a single argument, the message received.

In the general case, messages that originate from an Alexa skill request will have a `request` member with a full copy of the original request. The skill passes most request types down to the Play Canvas game. You can extend your skill endpoint code to send new kinds of messages. Specific kinds of standard messages are additionally parsed for convenience by the alexaHost script.

## Voice Input - Intents
Alexa skills model customer vocal utterances using the concept of an [Intent](https://developer.amazon.com/en-US/docs/alexa/custom-skills/create-the-interaction-model-for-your-skill.html). In brief: using the Alexa tools, a developer describes all the ways a customer could specify the intent, as well as defines slots for things that might be variable. For instance to purchase items, you might define a `PurchaseItems` intent, specifying `Amount` and `Type` slots, and at least one sample utterance like, *"I'd like to buy {Amount} {Item} please".* At runtime, intents are delivered to a developer's skill endpoint in the form of a JSON request object.

When the alexaHost script raises the `alexaMessage` event to propagate an intent to the Play Canvas game, it include the following members in the object:
* `request`, the original [Intent Request](https://developer.amazon.com/en-US/docs/alexa/custom-skills/request-types-reference.html#intentrequest) object from Alexa 
* `intent`, for convenience, the extracted intent name, as specified in your language model
* `slots`, for convenience, a map of the recognized slot values by slot name, including potential variations from multiple resolvers, flattened into an array.

Within the context of a game, often it'll be sufficient to inspect the `intent` member to determine what to do, and then work with the values in the `slots` object to reconcile in-game references.

All slot values are presented as strings, even if the slot type you've defined is a number. Because of the ambiguities of human speech and the potential breadth of your language model, it's also possible that slots may contain values outside of your initial specification. For example: if you have an intent that refers to character names in your game, e.g. `SendMessage`, with the sample utterance *"send a message to {Character}"*, and you define `Character` as `["Abby", "Bob"]`, if your player then says, *"send a message to Jeremy"*, Alexa may be confident enough that it's clear the player wants the `SendMessage` intent, and will do its best to fill in `Character`, potentially accurately transcribing the value `Jeremy` in position.

To work with numbers, the `alexaHost.js` script provides a global `alexaNumberFromSlotValue` function. It will extract a number from the given slot values if possible, or return undefined.

Here's an example of listening for the PurchaseItems intent we mentioned above:

```JavaScript
var Store = pc.createScript('Store');

Store.prototype.initialize = function() {
  pc.app.on('alexaMessage', this.onAlexaMessage, this);
}

Store.prototype.onAlexaMessage = function(msg) {
  switch( msg.intent ) {
    case "PurchaseItems":
      const itemType = msg.slots.Type;
      const itemCount = alexaNumberFromSlotValue(msg.slots.Count);
      if ( !validateItemType(itemType) ) {
        // indicate to the player that they have specified an item 
        // type that doesn't exist; maybe ask again, or display a 
        // list of valid choices, whatever makes sense in the context
        return;
      }
      
      if ( itemCount === undefined ) {
        // indicate to the player that they have specified an invalid
        // amount
        return;
      }
      
      // do purchasing
      break;
  }  
}
```

## Monetization 

Alexa skills can monetize their services in [a number of different ways](https://developer.amazon.com/en-US/docs/alexa/custom-skills/sell-products-in-an-alexa-skill.html), including one time purchases, consumable purchases, and subscriptions. To support them in your game, you'll need to do *entitlement* checks, that is to say check whether a particular feature in your game should be enabled for a particular player, based on their purchase history. The alexaHost scriptType offers a prebuilt pipeline to do this:
1. Set up your Alexa [In-Skill Purchase Products](https://developer.amazon.com/en-US/docs/alexa/in-skill-purchase/create-isp-dev-console.html)
2. The skill endpoint provided here will automatically fetch the current player's entitlements and send them down to the PlayCanvas game. Because there is an asynchronous delay in fetching them, they are delivered via a `alexaEntitlementsUpdated` message raised on the global `pc` object. The event comes with a single argument that is a list of [InSkillProduct](https://developer.amazon.com/en-US/docs/alexa/in-skill-purchase/in-skill-product-service.html#inskillproducts) objects.

Here's an example where you might offer different levels to play based on whether the player has purchased expansion packs.

```JavaScript
// Assuming we have a scriptType that control access to levels
var LevelsMenu = pc.createScript('LevelsMenu');

LevelsMenu.prototype.initialize = function() {
  pc.app.on('alexaEntitlementsUpdated', this.onAlexaEntitlementsUpdated, this);

  // Imagining this is an array of level objects that can be 
  // enabled or disabled. They might be child entities with elements 
  // representing GUI options.
  // You'll want to set all paid content to disabled to start with
  // we'll turn it on later in the entitlement check.
  this.levels = [ /* level data */ ];
}

LevelsMenu.prototype.onAlexaEntitlementsUpdated = function(products) {
  // loop over each product
  for ( let p of products ) {
    // work out what the product applies to by using the referenceName
    // we set up in the Alexa developer portal
    switch ( p.referenceName ) {
      case 'LevelPack1': 
        for ( let level of this.levels ) {
          // in this case we're imagining that each level is tagged
          // with a property that tells us which level pack it belongs to
          if ( level.pack === 1 ) {
            // because purchases can be refunded, or subscriptions 
            // cancelled, if you want to revoke access, be sure to always
            // synchronize to the latest state
            level.enabled = p.entitled === 'ENTITLED';
          }
        }
        break;
      case 'LevelPack2': 
        for ( let level of this.levels ) {
          if ( level.pack === 2 ) {
            level.enabled = p.entitled === 'ENTITLED';
          }
        }
        break;
    }
  }
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
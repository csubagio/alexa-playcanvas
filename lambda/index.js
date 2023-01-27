/**
 * Originally from https://github.com/csubagio/alexa-playcanvas
 * 
 * This generic integration provides support for hosting a Play Canvas 
 * game on Alexa devices using the Alexa Web API for Games.
 *   
 * The repo it is distributed in, is formatted ot be compatible with the 
 * Alexa CLI tools, and the Alexa Hosted Skills feature. The handler
 * this file exports should be compatible with any nodejs based 
 * hosting solution though, feel free to paraphrase it as needed.
 */





/**
 * Change this string to point to your own Play Canvas game. 
 * Note the use of the URL form with the "/e" in the URL to indicate
 * we want the embedded version without an iFrame. For example:
 * https://playcanv.as/e/p/XT3LYsQ7/
 */
const PlayCanvasGameURL = "https://playcanv.as/e/p/XT3LYsQ7/";





/**
 * This block initializes persistent storage for players using an 
 * AWS Dynamo DB table online. One is provided as part of the free 
 * infrastructure when you use Alexa Hosted Skills. 
 * If your needs differ, you can either switch out the adapter,
 * or provide your own data where the code below refers to the ASK
 * SDK's `attributesManager`.
 */
const AWS = require('aws-sdk')
const https = require('https');
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');
const dynamoDbPersistenceAdapter = new DynamoDbPersistenceAdapter({ 
    tableName : process.env.DYNAMODB_PERSISTENCE_TABLE_NAME,
    createTable: false,
    dynamoDBClient: new AWS.DynamoDB({
        apiVersion: 'latest', 
        region: process.env.DYNAMODB_PERSISTENCE_REGION,
        httpOptions: { agent: new https.Agent({keepAlive: true}) }
    })
});




const Alexa = require('ask-sdk-core');


/**
 * LaunchRequestHandler handles the Alexa Launch request.
 * It is responsible for fetching and collating information from the 
 * persistent storage and entitlements systems, and then launching 
 * the game with that info.
 */
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        // when we're coming back from the skills store, we want mostly the same behavior
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest'
            || Alexa.getRequestType(handlerInput.requestEnvelope) === 'Connections.Response';
    },
    async handle(handlerInput) {
        /** Fast exit, this skill won't support devices without screens */
        if ( !Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.HTML'] ) {
            let speech = `Unfortunately this game and this device are not compatible. Please try again on an Echo Show or Fire TV.`;
            return handlerInput.responseBuilder
                .speak(speech)
                .withShouldEndSession(true)
                .getResponse();   
        }

        const fetches = [];
        
        /** fetch this player's save game from the database */
        const attributesManager = handlerInput.attributesManager;
        let persistentData = undefined;
        fetches.push(attributesManager.getPersistentAttributes()
        .then( (data) => {
            persistentData = data || {};
        }));
        
        /** fetch this player's purchases from the store */
        const locale = handlerInput.requestEnvelope.request.locale;        
        let inSkillProducts = undefined;
        const msc = handlerInput.serviceClientFactory.getMonetizationServiceClient();
        fetches.push( msc.getInSkillProducts(locale)
        .then( (result) => {
            inSkillProducts = result.inSkillProducts || [];
        }).catch( (err) => {
            console.error(err);
            console.error(`failed to fetch in skill purchases. We will not prevent launch, but entitlements will be missing.`);
        }));
        
        /** this may be a connection result, which means we're coming back from the store */
        let purchaseResult = undefined;
        if ( Alexa.getRequestType(handlerInput.requestEnvelope) === 'Connections.Response' ) {
            // fish out the result
            purchaseResult = handlerInput.requestEnvelope.request.payload.purchaseResult;
        }

        await Promise.all( fetches );        
        
        /** pack everything into the Start directive and launch on device */        
        let htmlStartDirective = {
            type: "Alexa.Presentation.HTML.Start",
            data: {
                persistentData: persistentData,
                inSkillProducts: inSkillProducts,
                locale: locale,
                purchaseResult,
                hint: "hello"
            },
            request: {
                uri: PlayCanvasGameURL,
                method: "GET",
            },
            configuration: {
                timeoutInSeconds: 600
            },
            transformers: [
                {
                    inputPath: `hint`,
                    transformer: "textToHint"
                }
            ]
        };
        
        return handlerInput.responseBuilder
            .addDirective(htmlStartDirective)
            .withShouldEndSession(undefined)
            .getResponse();
    }
};


/**
 * Note: per skill store guidelines, we must quit the skill when the customer says any StopIntent
 * */
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};


/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs
 * 
 * There's nothing interesting we can do here, our app in the webview on device will have already been closed 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.getResponse();
    }
};

/* *
 * Because we're writing our logic entirely in the Play Canvas game in the webview, here we just convert
 * the request into a message to send there.
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const messageDirective = {
            type:"Alexa.Presentation.HTML.HandleMessage",
            message: { request: Alexa.getRequest(handlerInput.requestEnvelope) }
        }

        return handlerInput.responseBuilder
            .addDirective(messageDirective)
            .withShouldEndSession(undefined)
            .getResponse();
    }
};

/**
 * Generic error handling to capture any syntax or routing errors.
 * We'll just close the mic and expect the play will try whatever action it was again
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error( error );
        const speakOutput = 'Sorry, there was an error. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(undefined)
            .getResponse();
    }
};


/**
 * This handler processes all messages sent to us by the game, via the 
 * HTML API. To reduce the amount of messaging, we support a bunch of 
 * different features interleaved together, based on the presence of 
 * specifically named keys, so that we can ask for more than one thing 
 * per message.
 */
const ProcessHTMLMessageHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "Alexa.Presentation.HTML.Message";
    },
    async handle(handlerInput) {
        const request = Alexa.getRequest(handlerInput.requestEnvelope);
        const message = request.message;
        
        // collect outputs for our response
        const speech = [];
        let endSession = undefined;
        let sendHTMLMessage = false;
        const htmlMessage = {};
        const htmlTransformers = [];
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        if ( message.time ) {
            // debug facility to help measure latence. If we send a
            // timestamp, the skill will speak out the amount of time that has 
            // passed on the clock, by the time the message is received here
            const lag = Date.now() - message.time;
            if ( lag > 1000 ) {
                speech.push( `send ${Math.floor(lag/1000)} seconds ago,`);
            } else {
                speech.push( `sent ${lag} milliseconds ago,`);
            }
        }

        if ( message.speech !== undefined ) {
            // this lets us ask that the standard Alexa skill audio player
            // speak out some generated speech. Useful when we need to tell 
            // the player something, but we don't want to play it in the game
            // audio. For example, when the skill is about to quit, the web
            // app will be torn down, but we can still speak a parting message.
            speech.push( message.speech );
        }

        if ( message.transform !== undefined ) {
            // this is part of a scheme in the game that allow us to ask for 
            // speech to be converted from text, but returned for playback 
            // as part of the game audio. That lets us adjust the volume and
            // tightly coordinate animations in game to match the speech.
            sendHTMLMessage = true;
            htmlMessage.transformed = message.transform;
            for ( let key in htmlMessage.transformed ) {
                htmlTransformers.push({
                    inputPath: `transformed.${key}.text`,
                    transformer: "ssmlToSpeech",
                    outputName: "url"
                })
            }
        }
        
        // After every Alexa response, we have to decide whether the skill 
        // is finished. Usually Alexa skills represent short tasks, but in our
        // case of being a game, our default is to return undefined as 
        // initialized above, which means don't quit, but don't open the 
        // microphone either;
        if( message.endSession === true ) {
            // If we're done with the game, we indicate that here
            endSession = true;
        } else if ( message.prompt === true ) {
            // If we do actually want to open the microphone we ask for 
            // that here. Note that if we include alexa speech above, the 
            // microphone won't open until the speech is done.
            endSession = false;
        }
        
        if ( message.persistentData ) {
            // To save player data between gaming sessions, we're writing it
            // to the persistence adapter initialized above.
            // We have to wait here because in an AWS lambda, all processing
            // will end once this handler resolves.
            const attributesManager = handlerInput.attributesManager;
            console.log(`going to save: ${JSON.stringify(message.persistentData)}`);
            attributesManager.setPersistentAttributes(message.persistentData);
            await attributesManager.savePersistentAttributes();
        }
        
        // Compose the final response based on the stuff we've done above
        let builder = handlerInput.responseBuilder;
        let skillWillQuit = endSession === true;
        
        if ( message.startPurchase ) {
            // skill connections cannot be launched directly from this request
            // so we'll bounce the customer through a verbal confirmation first
            speech.push("Would you like to open the Alexa skill store?");
            skillWillQuit = true;
            endSession = false;
            sessionAttributes.waitingForPurchaseConfirmation = true;
            sessionAttributes.purchaseProductId = message.startPurchase;
        }
        
        if ( speech.length > 0 ) {
            builder.speak( speech.join(' ') );
        } else {
            builder.speak( '' );
        }

        if ( sendHTMLMessage ) {
            if ( skillWillQuit ) {
                console.error(`Cannot send an HTML message when we're going to quit. Ignoring message ${JSON.stringify(htmlMessage,null,2)}`);
            } else {
                builder.addDirective({
                    type:"Alexa.Presentation.HTML.HandleMessage",
                    message: htmlMessage,
                    transformers: htmlTransformers
                });
            }
        }

        return builder.withShouldEndSession(endSession).getResponse();
    }
}


/**
 * This handler only kicks in if we've asked the question in ProcessHTMLMessageHandler
 * about whether the customer wants to transition to the skill store.
 * */
const PurchaseConfirmationHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && sessionAttributes.waitingForPurchaseConfirmation;
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const intent = Alexa.getIntentName(handlerInput.requestEnvelope);
        if ( intent === 'AMAZON.YesIntent' ) {
            // positive confirmation, go to the store
            sessionAttributes.waitingForPurchaseConfirmation = false;
            return handlerInput.responseBuilder
                .addDirective({
                    type: "Connections.SendRequest",
                    name: "Buy",
                    payload: {
                        InSkillProduct: {
                            productId: sessionAttributes.purchaseProductId,
                        }
                    },
                    token: "correlationToken"
                })
                .withShouldEndSession(undefined)
                .getResponse();
        } else if ( intent === 'AMAZON.NoIntent' || intent === 'AMAZON.CancelIntent' ) {
            // negative confirmation, just back off and wait for the next thing
            sessionAttributes.waitingForPurchaseConfirmation = false;
            return handlerInput.responseBuilder
                .withShouldEndSession(undefined)
                .getResponse();
        } else {
            // unsure, let's reprompt
            return handlerInput.responseBuilder
                .speak("I didn't get that. Do you want to open the skill store?")
                .withShouldEndSession(false)
                .getResponse();
        }
    }
};


/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestInterceptors( (handlerInput) => {
        // for debugging purposes we'll log every request we receive
        console.log(JSON.stringify(handlerInput.requestEnvelope));
    })
    .addResponseInterceptors( (handlerInput, response) => {
        // for debugging purposes we'll log every response we return
        console.log(JSON.stringify(response));
    })
    .addRequestHandlers(
        LaunchRequestHandler,
        PurchaseConfirmationHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler,
        ProcessHTMLMessageHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('alexa-playcanvas-v1.0')
    .withPersistenceAdapter(dynamoDbPersistenceAdapter)
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();
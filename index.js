const express = require("express");
const { Observable } = require("rxjs");
const isEqual = require("lodash/isEqual");
/**
 * This is the signalling server i created, now it does seem to working according to my tests with postman, although i dont really get http with the dart client
 * so please check
 */
class SignallingServer {
  constructor(port) {
    this.app = express();
    this.port = port || 3000;

    this.iceCandidates = new Map(); // Map keyed by userId
    this.answers = new Map(); // Map keyed by userId
    this.offer = new Map(); // Map keyed by userId

    this.iceCandidatesSubscriptions = new Map();
    this.answerSubscriptions = new Map();
    this.offerSubscriptions = new Map();

    this.nextClientId = 0;

    this.setupRoutes();
  }

  setupRoutes() {
    const app = this.app;

    // Middleware to parse JSON body
    app.use(express.json());

    // Function to create a subscribable stream for the iceCandidates map
    const createIceCandidatesChangeStream = (userId) => {
      let lastCandidateIndex = this.iceCandidates.get(userId)
        ? this.iceCandidates.get(userId).length
        : 0;

      return new Observable((subscriber) => {
        const checkArrayChange = () => {
          const candidates = this.iceCandidates.get(userId) || [];
          if (candidates.length > lastCandidateIndex) {
            const newCandidate = candidates[lastCandidateIndex];
            lastCandidateIndex = candidates.length;
            subscriber.next(newCandidate); // Emit the new candidate
          }
        };

        const intervalId = setInterval(checkArrayChange, 100); // Check for changes periodically

        return () => clearInterval(intervalId);
      });
    };

    // Function to create a subscribable stream for the answer map
    const createAnswerChangeStream = (userId) => {
      let currentAnswer = this.answers.get(userId) || "";

      return new Observable((subscriber) => {
        const checkAnswerChange = () => {
          const answer = this.answers.get(userId) || "";
          if (answer !== currentAnswer) {
            currentAnswer = answer;
            subscriber.next(currentAnswer); // Emit the new answer
          }
        };

        const intervalId = setInterval(checkAnswerChange, 100); // Check for changes periodically

        return () => clearInterval(intervalId);
      });
    };

    // Function to create a subscribable stream for the offer map
    const createOfferChangeStream = (userId) => {
      let currentOffer = this.offer.get(userId) || "";

      return new Observable((subscriber) => {
        const checkOfferChange = () => {
          const offer = this.offer.get(userId) || "";
          if (offer !== currentOffer) {
            currentOffer = offer;
            subscriber.next(currentOffer); // Emit the new offer
          }
        };

        const intervalId = setInterval(checkOfferChange, 100); // Check for changes periodically

        return () => clearInterval(intervalId);
      });
    };

    // SSE endpoint for clients to subscribe to iceCandidates changes
    app.get("/subscribe-iceCandidates/:userId", (req, res) => {
      const { userId } = req.params;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const iceCandidatesChangeStream = createIceCandidatesChangeStream(userId);
      const subscription = iceCandidatesChangeStream.subscribe({
        next: (newArray) => {
          res.write(`data: ${JSON.stringify(newArray)}\n\n`);
        },
        error: (err) => {
          console.error("Error:", err);
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

      this.iceCandidatesSubscriptions.set(subscription, userId);

      req.on("close", () => {
        subscription.unsubscribe();
        this.iceCandidatesSubscriptions.delete(subscription);
        res.end();
      });
    });

    // SSE endpoint for clients to subscribe to answer changes
    app.get("/subscribe-answer/:userId", (req, res) => {
      const { userId } = req.params;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const answerChangeStream = createAnswerChangeStream(userId);
      const subscription = answerChangeStream.subscribe({
        next: (newAnswer) => {
          res.write(`data: ${JSON.stringify(newAnswer)}\n\n`);
        },
        error: (err) => {
          console.error("Error:", err);
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

      this.answerSubscriptions.set(subscription, userId);

      req.on("close", () => {
        subscription.unsubscribe();
        this.answerSubscriptions.delete(subscription);
        res.end();
      });
    });

    // SSE endpoint for clients to subscribe to offer changes
    app.get("/subscribe-offer/:userId", (req, res) => {
      const { userId } = req.params;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const offerChangeStream = createOfferChangeStream(userId);
      const subscription = offerChangeStream.subscribe({
        next: (newOffer) => {
          res.write(`data: ${JSON.stringify(newOffer)}\n\n`);
        },
        error: (err) => {
          console.error("Error:", err);
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

      this.offerSubscriptions.set(subscription, userId);

      req.on("close", () => {
        subscription.unsubscribe();
        this.offerSubscriptions.delete(subscription);
        res.end();
      });
    });

    // Endpoint to add an ICE candidate
    app.post("/add-iceCandidate/:userId", (req, res) => {
      const { userId } = req.params;
      const { value } = req.body; // Expecting a map with keys candidate, sdpMid, sdpMLineIndex
      const { candidate, sdpMid, sdpMLineIndex } = value;

      if (!this.iceCandidates.has(userId)) {
        this.iceCandidates.set(userId, []);
      }
      this.iceCandidates.get(userId).push({ candidate, sdpMid, sdpMLineIndex });
      res.send(
        `Ice candidate added: ${JSON.stringify({
          candidate,
          sdpMid,
          sdpMLineIndex,
        })}`
      );
    });

    // Endpoint to set the answer variable
    app.post("/set-answer/:userId", (req, res) => {
      const { userId } = req.params;
      const { value } = req.body;
      this.answers.set(userId, value);
      res.send(`Answer set to: ${this.answers.get(userId)}`);
    });

    // Endpoint to set the offer variable
    app.post("/set-offer/:userId", (req, res) => {
      const { userId } = req.params;
      const { value } = req.body;
      this.offer.set(userId, value);
      res.send(`Offer set to: ${this.offer.get(userId)}`);
    });

    // Default route
    app.get("/", (req, res) => {
      res.send("Welcome to the server");
    });

    // Start the server
    this.app.listen(this.port, () => {
      console.log(`Signalling Server running at http://localhost:${this.port}`);
    });
  }
}

// Create an instance of SignallingServer and start listening
const signallingServer = new SignallingServer(3000);

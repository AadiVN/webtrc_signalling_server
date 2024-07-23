const express = require("express");
const { Observable } = require("rxjs");
const isEqual = require("lodash/isEqual");

class SignallingServer {
  constructor(port) {
    this.app = express();
    this.port = port || 3000;

    this.iceCandidates = [];
    this.answers = "";
    this.offer = "";

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

    // Function to create a subscribable stream for the iceCandidates array
    const createIceCandidatesChangeStream = () => {
      let lastCandidateIndex = this.iceCandidates.length;

      return new Observable((subscriber) => {
        const checkArrayChange = () => {
          if (this.iceCandidates.length > lastCandidateIndex) {
            const newCandidate = this.iceCandidates[lastCandidateIndex];
            lastCandidateIndex = this.iceCandidates.length;
            subscriber.next(newCandidate); // Emit the new candidate
          }
        };

        const intervalId = setInterval(checkArrayChange, 100); // Check for changes periodically

        return () => clearInterval(intervalId);
      });
    };

    // Function to create a subscribable stream for the answer variable
    const createAnswerChangeStream = () => {
      let currentAnswer = this.answer;

      return new Observable((subscriber) => {
        const checkAnswerChange = () => {
          if (this.answer !== currentAnswer) {
            currentAnswer = this.answer;
            subscriber.next(currentAnswer); // Emit the new answer
          }
        };

        const intervalId = setInterval(checkAnswerChange, 100); // Check for changes periodically

        return () => clearInterval(intervalId);
      });
    };

    // Function to create a subscribable stream for the offer variable
    const createOfferChangeStream = () => {
      let currentOffer = this.offer;

      return new Observable((subscriber) => {
        const checkOfferChange = () => {
          if (this.offer !== currentOffer) {
            currentOffer = this.offer;
            subscriber.next(currentOffer); // Emit the new offer
          }
        };

        const intervalId = setInterval(checkOfferChange, 100); // Check for changes periodically

        return () => clearInterval(intervalId);
      });
    };

    // Initialize streams
    const iceCandidatesChangeStream = createIceCandidatesChangeStream();
    const answerChangeStream = createAnswerChangeStream();
    const offerChangeStream = createOfferChangeStream();

    // SSE endpoint for clients to subscribe to iceCandidates changes
    app.get("/subscribe-iceCandidates", (req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

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

      this.iceCandidatesSubscriptions.set(subscription, true);

      req.on("close", () => {
        subscription.unsubscribe();
        this.iceCandidatesSubscriptions.delete(subscription);
        res.end();
      });
    });

    // SSE endpoint for clients to subscribe to answer changes
    app.get("/subscribe-answer", (req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

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

      this.answerSubscriptions.set(subscription, true);

      req.on("close", () => {
        subscription.unsubscribe();
        this.answerSubscriptions.delete(subscription);
        res.end();
      });
    });

    // SSE endpoint for clients to subscribe to offer changes
    app.get("/subscribe-offer", (req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

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

      this.offerSubscriptions.set(subscription, true);

      req.on("close", () => {
        subscription.unsubscribe();
        this.offerSubscriptions.delete(subscription);
        res.end();
      });
    });

    // Endpoint to add an ICE candidate
    app.post("/add-iceCandidate", (req, res) => {
      const { value } = req.body; // Expecting a map with keys candidate, sdpMid, sdpMLineIndex
      const { candidate, sdpMid, sdpMLineIndex } = value;
      this.iceCandidates.push({ candidate, sdpMid, sdpMLineIndex });
      res.send(
        `Ice candidate added: ${JSON.stringify({
          candidate,
          sdpMid,
          sdpMLineIndex,
        })}`
      );
    });

    // Endpoint to set the answer variable
    app.post("/set-answer", (req, res) => {
      const { value } = req.body;
      this.answer = value;
      res.send(`Answer set to: ${this.answer}`);
    });

    // Endpoint to set the offer variable
    app.post("/set-offer", (req, res) => {
      const { value } = req.body;
      this.offer = value;
      res.send(`Offer set to: ${this.offer}`);
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

const express = require("express");
const { isEqual } = require("lodash");
const { Observable } = require("rxjs");

class SignallingServer {
  constructor(port) {
    this.app = express();
    this.port = port || 3000;

    this.iceCandidatesMap = new Map();
    this.answersMap = new Map();
    this.offersMap = new Map();

    this.setupRoutes();
  }

  setupRoutes() {
    const app = this.app;

    // Middleware to parse JSON body
    app.use(express.json());

    // Function to create a subscribable stream for ICE candidates array
    const createIceCandidatesChangeStream = (userId) => {
      let lastCandidateIndex = this.iceCandidatesMap.get(userId)?.length || 0;

      return new Observable((subscriber) => {
        const checkArrayChange = () => {
          const iceCandidates = this.iceCandidatesMap.get(userId) || [];
          if (iceCandidates.length > lastCandidateIndex) {
            const newCandidate = iceCandidates[lastCandidateIndex];
            lastCandidateIndex = iceCandidates.length;
            subscriber.next(newCandidate); // Emit the new candidate
          }
        };

        const intervalId = setInterval(checkArrayChange, 100); // Check for changes periodically

        return () => clearInterval(intervalId);
      });
    };

    // Function to create a subscribable stream for the answer variable
    const createAnswerChangeStream = (userId) => {
      let currentAnswer = this.answersMap.get(userId);

      return new Observable((subscriber) => {
        const checkAnswerChange = () => {
          const newAnswer = this.answersMap.get(userId);
          if (!isEqual(newAnswer, currentAnswer)) {
            currentAnswer = newAnswer;
            subscriber.next(currentAnswer); // Emit the new answer
          }
        };

        const intervalId = setInterval(checkAnswerChange, 100); // Check for changes periodically

        return () => clearInterval(intervalId);
      });
    };

    // Function to create a subscribable stream for the offer variable
    const createOfferChangeStream = (userId) => {
      let currentOffer = this.offersMap.get(userId);

      return new Observable((subscriber) => {
        const checkOfferChange = () => {
          const newOffer = this.offersMap.get(userId);
          if (isEqual(newOffer, currentOffer)) {
            currentOffer = newOffer;
            subscriber.next(currentOffer); // Emit the new offer
          }
        };

        const intervalId = setInterval(checkOfferChange, 100); // Check for changes periodically

        return () => clearInterval(intervalId);
      });
    };

    // SSE endpoint for clients to subscribe to ICE candidates changes
    app.get("/subscribe-iceCandidates/", (req, res) => {
      const { userId } = req.query;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const iceCandidatesChangeStream = createIceCandidatesChangeStream(userId);
      const subscription = iceCandidatesChangeStream.subscribe({
        next: (newCandidate) => {
          res.write(`data: ${JSON.stringify(newCandidate)}\n\n`);
        },
        error: (err) => {
          console.error("Error:", err);
          res.end();
        },
        complete: () => {
          res.end();
        },
      });

      req.on("close", () => {
        subscription.unsubscribe();
        res.end();
      });
    });

    // SSE endpoint for clients to subscribe to answer changes
    app.get("/subscribe-answer/", (req, res) => {
      const { userId } = req.query;
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

      req.on("close", () => {
        subscription.unsubscribe();
        res.end();
      });
    });

    // SSE endpoint for clients to subscribe to offer changes
    app.get("/subscribe-offer/", (req, res) => {
      const { userId } = req.query;
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

      req.on("close", () => {
        subscription.unsubscribe();
        res.end();
      });
    });

    // Endpoint to add an ICE candidate
    app.post("/add-iceCandidate/:userId", (req, res) => {
      const { userId } = req.params;
      const { value } = req.body; // Expecting a map with keys candidate, sdpMid, sdpMLineIndex
      const { candidate, sdpMid, sdpMLineIndex } = value;

      if (!this.iceCandidatesMap.has(userId)) {
        this.iceCandidatesMap.set(userId, []);
      }

      this.iceCandidatesMap
        .get(userId)
        .push({ candidate, sdpMid, sdpMLineIndex });
      res.send(
        `ICE candidate added for user ${userId}: ${JSON.stringify({
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
      const { sdp, type } = value;
      this.answersMap.set(userId, { sdp, type });
      res.send(
        `Answer set for user ${userId}: ${JSON.stringify(
          this.answersMap.get(userId)
        )}`
      );
    });

    // Endpoint to set the offer variable
    app.post("/set-offer/:userId", (req, res) => {
      const { userId } = req.params;
      const { value } = req.body;
      const { sdp, type } = value;
      this.offersMap.set(userId, { sdp, type });
      res.send(
        `Offer set for user ${userId}: ${JSON.stringify(
          this.offersMap.get(userId)
        )}`
      );
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

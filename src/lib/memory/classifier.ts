// Linear classifier for memory layer routing
// Trainable with online learning

import type { Layer, RouterWeights } from "./types";

export class LinearClassifier {
  weights: RouterWeights;
  private dimension: number;

  constructor(dim: number, initialWeights?: RouterWeights) {
    this.dimension = dim;
    
    if (initialWeights) {
      this.weights = initialWeights;
    } else {
      // Initialize with small random values
      this.weights = {
        IMM: new Array(dim).fill(0).map(() => (Math.random() - 0.5) * 0.1),
        EMM: new Array(dim).fill(0).map(() => (Math.random() - 0.5) * 0.1),
        KMM: new Array(dim).fill(0).map(() => (Math.random() - 0.5) * 0.1),
      };
    }
  }

  // Predict probabilities for each layer using softmax
  predict(x: number[]): Record<Layer, number> {
    const scores = {
      IMM: this.dot(this.weights.IMM, x),
      EMM: this.dot(this.weights.EMM, x),
      KMM: this.dot(this.weights.KMM, x),
    };

    // Softmax with numerical stability
    const maxScore = Math.max(scores.IMM, scores.EMM, scores.KMM);
    const exp = {
      IMM: Math.exp(scores.IMM - maxScore),
      EMM: Math.exp(scores.EMM - maxScore),
      KMM: Math.exp(scores.KMM - maxScore),
    };

    const sum = exp.IMM + exp.EMM + exp.KMM;

    return {
      IMM: exp.IMM / sum,
      EMM: exp.EMM / sum,
      KMM: exp.KMM / sum,
    };
  }

  // Get the most likely layer
  predictLayer(x: number[]): { layer: Layer; confidence: number } {
    const probs = this.predict(x);
    const sorted = (Object.entries(probs) as [Layer, number][])
      .sort((a, b) => b[1] - a[1]);
    
    return {
      layer: sorted[0][0],
      confidence: sorted[0][1],
    };
  }

  // Online learning with gradient descent
  train(x: number[], correct: Layer, lr = 0.05) {
    const probs = this.predict(x);

    (["IMM", "EMM", "KMM"] as Layer[]).forEach(layer => {
      const error = (layer === correct ? 1 : 0) - probs[layer];
      for (let i = 0; i < x.length; i++) {
        this.weights[layer][i] += lr * error * x[i];
      }
    });
  }

  // Batch training
  trainBatch(samples: { x: number[]; label: Layer }[], lr = 0.05) {
    for (const sample of samples) {
      this.train(sample.x, sample.label, lr);
    }
  }

  private dot(a: number[], b: number[]): number {
    let s = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      s += a[i] * b[i];
    }
    return s;
  }

  getDimension(): number {
    return this.dimension;
  }
}

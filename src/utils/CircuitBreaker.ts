/**
 * Enum representing the possible states of a circuit breaker
 * Used to control the flow of requests based on the health of the service
 */
export enum CircuitState {
	/** Normal operation, requests flow through */
	CLOSED,

	/** Circuit is open, requests are blocked */
	OPEN,

	/** Testing if the service has recovered */
	HALF_OPEN,
}

/**
 * A circuit breaker implementation to prevent cascading failures
 * when external APIs are down or experiencing issues.
 * Implements the standard closed -> open -> half-open -> closed state machine.
 */
export class CircuitBreaker {
	/** Count of consecutive failures */
	private failures: number = 0;

	/** Timestamp of the last failure */
	private lastFailureTime: number = 0;

	/** Current state of the circuit breaker */
	private state: CircuitState = CircuitState.CLOSED;

	/** Number of failures before opening the circuit */
	private readonly threshold: number;

	/** Time in ms before attempting to close the circuit again */
	private readonly resetTimeout: number;

	/** Timestamp of the last attempt in half-open state */
	private halfOpenAttemptTime: number = 0;

	/**
	 * Creates a new CircuitBreaker instance
	 * @param threshold Number of failures before opening the circuit
	 * @param resetTimeout Time in ms before attempting to close the circuit again (half-open state)
	 */
	constructor(threshold: number = 5, resetTimeout: number = 60000) {
		this.threshold = threshold;
		this.resetTimeout = resetTimeout;
	}

	/**
	 * Gets the current state of the circuit breaker
	 * @returns The current circuit state
	 */
	public getState(): CircuitState {
		this.updateState();
		return this.state;
	}

	/**
	 * Checks if the circuit is currently open (too many failures)
	 * @returns true if the circuit is open, false otherwise
	 */
	public isOpen(): boolean {
		this.updateState();

		// If in half-open state, allow one test request through
		if (this.state === CircuitState.HALF_OPEN) {
			// Only allow one request in half-open state
			if (Date.now() - this.halfOpenAttemptTime < 1000) {
				return true; // Block additional requests while testing
			}

			// Allow one test request
			this.halfOpenAttemptTime = Date.now();
			return false;
		}

		return this.state === CircuitState.OPEN;
	}

	/**
	 * Updates the internal state based on timing and failure count
	 */
	private updateState(): void {
		// If we're open and the timeout has elapsed, transition to half-open
		if (
			this.state === CircuitState.OPEN &&
			Date.now() - this.lastFailureTime > this.resetTimeout
		) {
			this.state = CircuitState.HALF_OPEN;
		}
		// If we're closed but have too many failures, transition to open
		else if (
			this.state === CircuitState.CLOSED &&
			this.failures >= this.threshold
		) {
			this.state = CircuitState.OPEN;
		}
	}

	/**
	 * Records a successful operation
	 * If in half-open state, this will close the circuit
	 */
	public recordSuccess(): void {
		if (this.state === CircuitState.HALF_OPEN) {
			// If we succeed in half-open state, close the circuit
			this.state = CircuitState.CLOSED;
			this.failures = 0;
		} else if (this.state === CircuitState.CLOSED) {
			// In closed state, just reset failures
			this.failures = 0;
		}
		// In open state, success has no effect until timeout
	}

	/**
	 * Records a failed operation, incrementing the failure count
	 * If in half-open state, this will reopen the circuit
	 */
	public recordFailure(): void {
		this.lastFailureTime = Date.now();

		if (this.state === CircuitState.HALF_OPEN) {
			// If we fail in half-open state, reopen the circuit
			this.state = CircuitState.OPEN;
		} else if (this.state === CircuitState.CLOSED) {
			// In closed state, increment failures and possibly open circuit
			this.failures++;
			if (this.failures >= this.threshold) {
				this.state = CircuitState.OPEN;
			}
		}
		// In open state, failure has no effect
	}
}

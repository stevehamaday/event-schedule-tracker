import React, { Component } from 'react';

class CountdownTimer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            timeLeft: props.initialTime,
            isActive: false,
        };
        this.interval = null;
    }

    startTimer = () => {
        if (!this.state.isActive) {
            this.setState({ isActive: true });
            this.interval = setInterval(this.tick, 1000);
        }
    };

    stopTimer = () => {
        clearInterval(this.interval);
        this.setState({ isActive: false });
    };

    resetTimer = () => {
        this.stopTimer();
        this.setState({ timeLeft: this.props.initialTime });
    };

    tick = () => {
        this.setState(prevState => {
            if (prevState.timeLeft > 0) {
                return { timeLeft: prevState.timeLeft - 1 };
            } else {
                this.stopTimer();
                return { timeLeft: 0 };
            }
        });
    };

    componentWillUnmount() {
        this.stopTimer();
    }

    render() {
        const { timeLeft, isActive } = this.state;
        return (
            <div>
                <h2>Countdown Timer</h2>
                <div>{timeLeft} seconds left</div>
                <button onClick={this.startTimer} disabled={isActive}>Start</button>
                <button onClick={this.stopTimer}>Stop</button>
                <button onClick={this.resetTimer}>Reset</button>
            </div>
        );
    }
}

export default CountdownTimer;
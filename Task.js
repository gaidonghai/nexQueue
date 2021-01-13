class Task {
    constructor(workFunction, options) {
        this.workFunction = workFunction; //mandatory
        this.id = options.id; //will be automatically generated as TASK-xx if ignored

        if (options.doneChecker) {
            this.doneChecker = options.doneChecker;
        } else {
            this.doneChecker = () => false;
        }
        this.forceRerun = options.forceRerun || false;
        this.timeOut = options.timeOut;

        //Initialization
        this.specials = [];
    }

    get status() {
        let conclusion;
        if (this.startAt) {
            if (this.acutalWork) {
                if (this.endAt) {
                    if (this.error) {
                        conclusion = 'Failed'
                    } else {
                        conclusion = 'Finished'
                    }
                } else {
                    conclusion = 'Running'
                }
            } else {
                conclusion = 'Skipped'
            }
        } else {
            conclusion = 'Initialized';
        }
        return conclusion
    }

    get duration() {
        if (!this.endAt) return;
        let milliseconds = (this.endAt - this.startAt).toString();
        milliseconds = milliseconds.padStart(4, '0');
        return milliseconds.slice(0, -3) + '.' + milliseconds.slice(-3);
    }

    statusMessageCSV(columns) {
        if (!columns) columns = ['id', 'status', 'startAt', 'duration', 'specials', 'error'];
        return columns.map(o => this.statusMessage[o]).join(', \t');
    }

    get statusMessage() {
        let message = {};
        message.id = this.id;
        message.status = this.status//.padEnd(12, ' ');
        message.startAt = this.startAt ? new Date(this.startAt).toISOString();
        message.duration = this.duration;
        message.specials = this.specials.length?'[' + this.specials.join(' ') + ']':'';
        message.error = this.error ? this.error.toString() : undefined;
        return message
    }


    async run() {
        this.startAt = Date.now();
        this.doneCheck = this.doneChecker();
        if (this.doneCheck) {
            this.specials.push('previouslyDone')
        }

        this.rerun = this.doneCheck && this.forceRerun;
        if (this.rerun) {
            this.specials.push('rerunApplied')
        }

        this.acutalWork = !this.doneCheck || this.rerun;
        if (this.acutalWork) {
            try {
                this.returnValue = await this.workFunction()
            } catch (err) {
                this.specials.push('failed');
                this.error = err;
            }
        } else {
            this.specials.push('skipped')
        }
        this.endAt = Date.now();
    }
}

module.exports = Task;
const fs = require('fs');
const path = require('path');

class Queue {
    constructor(options) {

        //set options
        this.concurrency = options.concurrency;
        this.forceRerun = options.forceRerun || false;
        this.logger = options.logger || console.log.bind(console);
        this.statusFile = options.statusFile;
        this.statusHistory = options.statusHistory;
        this.statusFrequency = options.statusFrequency || 1000;

        //Initialization
        this.todo = [];
        this.finished = [];
        this.failed = [];
        this.processors = {};
        this.processorPromises = [];

        this.taskCount = 0;
    }

    enqueue(workFunction, options) {
        //Queue-wise forceRerun shall override if set
        options.forceRerun = this.forceRerun || options.forceRerun
        if (!options.id) options.id= `TASK-${this.taskCount+1}`
        this.todo.push(new Task(workFunction, options));
        this.taskCount++;
    }

    async start() {
        for (let i = 0; i < this.concurrency; i++) {
            this.processorPromises.push(this.startProcessor(`Processor-${i + 1}`));
        }

        if (this.statusFile) await this.statusUpdater();
        await Promise.all(this.processorPromises);
        return ('All Done');
    }

    statusUpdater() {
        let data = ''
        data += 'Logged at: ' + new Date() + '\n\n';
        data += 'Processor status:\n'
        Object.entries(this.processors).forEach(([processor, task]) => {
            data += `${processor}: ${task ? task.id : '<null>'}\n`
        })
        data += '\n'

        data += 'To-do:\n'
        this.todo.forEach(task => {
            data += `${task.id}\n`
        })
        data += '--------\n\n'

        data += 'Finished:\n'
        this.finished.forEach(task => {
            data += `${task.id}`
            if (task.specials.length > 0) data += `: (${task.specials.join(', ')})`;
            data += '\n'
        })
        data += '--------\n\n'

        data += 'Failed:\n'
        this.failed.forEach(task => {
            data += `${task.id}: ${task.specials.join(', ')}, `;
            data += `${task.error}\n`;
        })
        data += '--------\n\n'

        if (this.statusFile) fs.writeFileSync(this.statusFile, data)
        if (this.statusHistory) fs.writeFileSync(path.join(this.statusHistory, `${Date.now()}.txt`), data)

        //Repeat this 1 seconds later if there are still work to be done:
        if (!Object.values(this.processors).every(o => o === null))
            setTimeout(this.statusUpdater.bind(this), this.statusFrequency);

    }

    async startProcessor(processorId) {
        //get a task, do it, and work on the next until all are processed
        this.logger(`${processorId}: processor started`)
        let task;
        while (task = this.todo.shift()) {
            this.logger(`${processorId}: ${task.id} assigned`);
            this.processors[processorId] = task;
            let runResult = await task.run(this.forceRerun);

            if (task.error) {
                this.logger(`${processorId}: failed with error ${task.error}`)
                this.failed.push(task)
            } else {
                let msg = `${processorId}: finished`;
                if (task.specials.length > 0) msg += ` (${task.specials.join(',')})`
                this.logger(msg);
                this.finished.push(task);
            }
            this.processors[processorId] = null;
        }
        this.logger(`${processorId}: todo list empty, exiting`);
    }
}

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


    async run() {

        this.doneCheck = this.doneChecker();
        if (this.doneCheck) {
            this.specials.push('previously done')
        }

        this.rerun = this.doneCheck && this.forceRerun;
        if (this.rerun) {
            this.specials.push('rerun applied')
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

    }
}

module.exports = Queue;
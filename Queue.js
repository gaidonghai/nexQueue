const nexFs = require('nexfs');
const path = require('path');
const Task =require('./Task')

class Queue {
    constructor(options) {

        //set options
        this.concurrency = options.concurrency || 1;
        this.forceRerun = options.forceRerun || false;
        this.logger = options.logger || console.log.bind(console);
        this.statusFile = options.statusFile;
        this.statusHistory = options.statusHistory;
        this.statusFrequency = options.statusFrequency || 1000;

        //Initialization
        this.allTasks = [];
        this.todo = [];
        this.finished = [];
        this.failed = [];
        this.processors = {};
        this.processorPromises = [];

    }

    enqueue(workFunction, options) {
        //Queue-wise forceRerun shall override if set
        options.forceRerun = this.forceRerun || options.forceRerun
        if (!options.id) options.id = `TASK-${this.allTasks.length + 1}`
        let newTask = new Task(workFunction, options)
        this.todo.push(newTask);
        this.allTasks.push(newTask);
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
        data += 'Processors:\n'
        Object.entries(this.processors).forEach(([processor, task]) => {
            data += `${processor}: ${task ? task.id : '<null>'}\n`
        })
        data += '\n'

        data += 'Tasks:\n'
        data += this.allTasks.map(o => o.statusMessageCSV()).join('\n');

        if (this.statusFile) nexFs.writeFileSync(this.statusFile, data)
        if (this.statusHistory) nexFs.writeFileSync(path.join(this.statusHistory, `${Date.now()}.txt`), data)

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


module.exports = Queue;
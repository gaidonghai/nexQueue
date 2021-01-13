// This example script will create 50 empty text files in the 'results' subdirectory
// each creation is a task that will cost 2 seconds by imposing a delay
// if target file exists then task is considered done and will be skipped
// this behavior can be disabled by setting forceRerun option to be true
// forceRerun can also be set at task level

// The running status can be logged as a single file, or to be recorded in a history folder



const path = require('path');
const fs = require('fs');
const Queue = require('.');

//Prepare the directory
let targetPath = path.join(__dirname, 'results');
if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath)

//Create the queue
let queue = new Queue({
    concurrency: 5,
    forceRerun: false,
    logger: console.log.bind(console), //same if leave undefined
    statusFile: path.join(__dirname, 'status.txt'),
    statusFrequency: 1000,
    statusHistory:path.join(__dirname, 'logs'),
})

//Create jobs
for (let i = 1; i <=50; i++) {
    queue.enqueue(createWork(i), {
        //id: `TASK-${i}`, //same if leave undefined
        doneChecker: createChecker(i),
        forceRerun: Math.floor(i / 10) === i / 10 //certain task(1,11,21...) always rerun even if already done.
    })
}

queue.start().then(console.log.bind(console));


function createWork(i) {
    if (i != 13) {
        return async function () {
            //Write empty file
            fs.writeFileSync(path.join(targetPath, `${i}.txt`), '');
            //Create a deliberate delay for observation.
            await sleep(2000);

            async function sleep(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }
        }
    } else {
        console.log('Task-13 is doomed to fail')
        return async function () {
            throw Error('13 is unlucky');
        }
    }
}

function createChecker(i) {
    //If file exist, then consider it done.
    return function () {
        return fs.existsSync(path.join(targetPath, `${i + 1}.txt`));
    }
}

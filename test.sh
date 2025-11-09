# to initialize workers
npm run worker -- --count 1

# to check the pending jobs and processing jobs
npm run enqueue -- '{"id":"p2","command":"sleep 20 && echo P2"}'
npm run enqueue -- '{"id":"ok1","command":"echo OK"}'
npm run status

# to enqueue a job that will fail
npm run enqueue -- '{"id":"failjob1","command":"exit 1","max_retries":"3"}'
npm run status

# dlq commmands
npm run dlq-list
npm run dlq -- retry <job-id>

#to stop workers
npm run stop

# config commands
npm run config -- get
npm run config -- set max-retries 3
npm run config -- set backoff-base 1000 (to set back-off base)


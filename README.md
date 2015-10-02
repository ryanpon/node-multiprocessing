# node-multiprocessing
Dead simple parallel processing for node


## Example

```javascript
var Pool = require('multiprocessing').Pool;

function square(x) {
  return x * x;
}

var pool = new Pool(4);  // spawns 4 child processes to complete your jobs

pool.map([1, 2, 3], square)
  .then(function (result) {
    console.log(result);
  });

// [1, 4, 9]
```


## Installation

Via npm:

    npm install multiprocessing


## API Reference

### new Pool(int numWorkers) -> Pool

Create a new Pool with specified number of worker child processes.

Recommended setting is the number of logical CPUs that your machine has.

### .map(Array arr, Function|String fnOrModulePath[, int chunksize]) -> Promise

The second argument should either be the mapper function or the absolute path of a module that exports the mapper function.

As the function must be stringified before being passed to the child process, I recommend instead using the module path for functions of non-trivial size. It will be much easier than trying to keep track of what your mapper function references.

Chunksize determines the number of array elements to be passed to the work process at once. By default, the chunksize will default to the array length divided by the number of available workers. Setting this to 1 is fine for tasks that are expected to be very large, but smaller tasks will run much faster with a larger chunksize.

```javascript
// Writing a mapper function:

function good(x) {
  return x * x;  // I don't reference any outside variables
}

var two = 2;
function bad(x) {
  return x * two;  // "two" wont be defined after being passed to the child proc
}
```

### .apply(any arg, Function|String fnOrModulePath) -> Promise

A convenience method for calling map with a single argument. Useful for when you want to use the pool as a queue that processes jobs in a first-come, first-served manner.


## License

  MIT

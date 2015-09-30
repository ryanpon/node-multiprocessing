# node-multiprocessing
Dead simple parallel processing for node

## Example

```javascript
var Pool = require('multiprocessing').Pool;

function square(x) {
  return x * x;
}

var pool = new Pool(4);

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

### .map(Array arr, Function|String fnOrModulePath[, int chunksize])

The second argument should either be the mapper function or the absolute path of a module that exports the mapper function.

Chunksize determines the number of array elements to be passed to the work process at once. By default, the chunksize will default to the array length divided by the number of available workers. Setting this to 1 is fine for tasks that are expected to be very large, but smaller tasks will run much faster with a larger chunksize.

## License

  MIT

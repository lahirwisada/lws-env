# lws-defined-hello

Thanks to [envy](https://www.npmjs.com/package/envy). But i cant set chmod 555 in my .env because i am inexperienced  windows user and don't want research for more, so i just change fs constant, because not all fs constant available for windows [fs file mode constants documentation](https://nodejs.org/api/fs.html#file-mode-constants)

## Install

```sh
npm install @lahirwisada/lws-env --save
```

## Usage

```
const envy = require('@lahirwisada/lws-env');
const env = lwenv();
console.log(env);
// {
//     foo : 'bar'
// }
```
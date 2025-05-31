# Code Citations

## License: unknown
https://github.com/126RockStar/YGO/tree/0a184ef1c65c83748f5bc5ee0a73820be80f9e88/admin-panel/src/routes/drag-drop/react-dnd/index.js

```
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

//
```


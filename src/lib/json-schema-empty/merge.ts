// merges the array of schema's
// into one usable schema
const merge = (schemas: any[]) => {
  return schemas.reduce((prev, next) => {
    return Object.assign(prev, next);
  }, {});
};

export default merge;

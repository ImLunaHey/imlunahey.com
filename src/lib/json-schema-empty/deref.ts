const getSchemaFromRefString = (schema: any, refString: string) => {
  var pieces = refString.split("/");
  if (pieces.shift() !== "#") {
    throw new Error("Local references only!");
  }

  return deref(
    pieces.reduce(function (prevObj, key) {
      if (!prevObj[key]) {
        throw new Error("Local references only!");
      }
      return prevObj[key];
    }, schema)
  );
};

export const deref = (schema: any) => {
  if (!schema.properties) {
    return schema;
  }

  Object.keys(schema.properties).forEach((propertyName) => {
    if (schema.properties.hasOwnProperty(propertyName)) {
      const property = schema.properties[propertyName];
      Object.keys(property).forEach((key) => {
        if (property.hasOwnProperty(key)) {
          if (key === "$ref") {
            schema.properties[propertyName] = getSchemaFromRefString(
              schema,
              property[key]
            );
          }
        }
      });
    }
  });

  return schema;
};

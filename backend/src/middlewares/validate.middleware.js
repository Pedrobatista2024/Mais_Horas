/**
 * Middleware de validação com zod.
 * Uso: validate({ body: schema, params: schema, query: schema })
 * Em caso de erro, o ZodError é capturado pelo error handler central.
 */
export const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    next();
  } catch (err) {
    next(err);
  }
};

export default validate;

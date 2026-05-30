/**
 * Envolve um handler async e encaminha qualquer erro pro middleware central,
 * eliminando o try/catch repetido em todos os controllers.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;

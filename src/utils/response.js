export const successResponse = (data, message = null) => {
  const response = {
    success: true
  };
  
  if (message) {
    response.message = message;
  }
  
  if (data !== undefined) {
    response.data = data;
  }
  
  return response;
};

export const errorResponse = (code, message, statusCode = 400) => {
  return {
    success: false,
    error: {
      code,
      message
    },
    statusCode
  };
};

export const sendSuccess = (res, data, message = null, statusCode = 200) => {
  return res.status(statusCode).json(successResponse(data, message));
};

export const sendError = (res, code, message, statusCode = 400) => {
  const error = errorResponse(code, message, statusCode);
  return res.status(error.statusCode).json({
    success: error.success,
    error: error.error
  });
};

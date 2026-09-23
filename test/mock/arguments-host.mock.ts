import type { ArgumentsHost } from '@nestjs/common';

export type MockHttpResponse = ReturnType<typeof generateMockHttpResponse>;

export function generateMockHttpResponse() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

export function generateMockArgumentsHost(
  response: MockHttpResponse = generateMockHttpResponse(),
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
      getNext: () => jest.fn(),
    }),
  } as unknown as ArgumentsHost;
}

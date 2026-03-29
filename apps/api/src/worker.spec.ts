describe('worker bootstrap', () => {
  const originalExit = process.exit;

  afterEach(() => {
    process.exit = originalExit;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('creates the application context, enables shutdown hooks and logs startup', async () => {
    const enableShutdownHooks = jest.fn();
    const createApplicationContext = jest.fn().mockResolvedValue({
      enableShutdownHooks,
    });
    const logMock = jest.fn();

    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        createApplicationContext,
      },
    }));

    jest.doMock('./worker.module', () => ({
      WorkerModule: class WorkerModule {},
    }));

    jest.doMock('@nestjs/common', () => {
      const actual = jest.requireActual('@nestjs/common');

      return {
        ...actual,
        Logger: jest.fn().mockImplementation(() => ({
          log: logMock,
          error: jest.fn(),
        })),
      };
    });

    jest.isolateModules(() => {
      require('./worker');
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(createApplicationContext).toHaveBeenCalledTimes(1);
    expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith('Campaign worker is running');
  });

  it('logs and exits when bootstrap fails', async () => {
    const bootstrapError = new Error('worker bootstrap failed');
    const createApplicationContext = jest
      .fn()
      .mockRejectedValue(bootstrapError);
    const errorMock = jest.fn();
    const exitMock = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        createApplicationContext,
      },
    }));

    jest.doMock('./worker.module', () => ({
      WorkerModule: class WorkerModule {},
    }));

    jest.doMock('@nestjs/common', () => {
      const actual = jest.requireActual('@nestjs/common');

      return {
        ...actual,
        Logger: jest.fn().mockImplementation(() => ({
          log: jest.fn(),
          error: errorMock,
        })),
      };
    });

    jest.isolateModules(() => {
      require('./worker');
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(errorMock).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});

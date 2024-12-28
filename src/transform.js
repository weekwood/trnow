const scanResults = await require('./scan').execute({
    ...flags,
    onProgress: (progress) => {
        if (typeof flags.onProgress === 'function') {
            flags.onProgress(progress);
        }
    },
    onBatchComplete: async ({ results, aiKeyMap, processedTexts }) => {
        // ... 批次处理代码
    }
}); 
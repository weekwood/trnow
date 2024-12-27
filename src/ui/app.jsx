const React = require('react');
const { Text, Box, useInput } = require('ink');
const SelectInput = require('ink-select-input').default;
const TextInput = require('ink-text-input').default;
const Spinner = require('ink-spinner').default;

const App = ({ command, flags }) => {
    const [status, setStatus] = React.useState('idle');
    const [results, setResults] = React.useState([]);
    const [progress, setProgress] = React.useState(null);
    const [initStep, setInitStep] = React.useState(0);
    const [initAnswers, setInitAnswers] = React.useState({});
    const [currentInput, setCurrentInput] = React.useState('');
    const [answers, setAnswers] = React.useState([]);
    const [selectedChoice, setSelectedChoice] = React.useState(0);
    const mounted = React.useRef(true);

    React.useEffect(() => {
        return () => {
            mounted.current = false;
        };
    }, []);

    const safeSetState = (setter) => {
        if (mounted.current) {
            setter();
        }
    };

    const initSteps = [
        {
            name: 'sourceDir',
            message: '源码目录路径:',
            initial: './src'
        },
        {
            name: 'localeDir',
            message: '语言文件目录:',
            initial: './src/locales'
        },
        {
            name: 'sourceLang',
            message: '源语言:',
            initial: 'zh-CN'
        },
        {
            name: 'targetLangs',
            message: '目标语言 (用逗号分隔):',
            initial: 'en-US'
        },
        {
            name: 'keyStyle',
            message: '选择 key 生成风格:',
            type: 'select',
            choices: [
                { title: 'snake_case', value: 'snake_case' },
                { title: 'camelCase', value: 'camelCase' }
            ]
        }
    ];

    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            process.exit(0);
        }
        
        if (initSteps[initStep]?.type === 'select') {
            if (key.upArrow || input === 'k') {
                safeSetState(() => setSelectedChoice(prev => 
                    prev > 0 ? prev - 1 : initSteps[initStep].choices.length - 1
                ));
            }
            if (key.downArrow || input === 'j') {
                safeSetState(() => setSelectedChoice(prev => 
                    prev < initSteps[initStep].choices.length - 1 ? prev + 1 : 0
                ));
            }
            if (key.return) {
                handleInitInput(initSteps[initStep].choices[selectedChoice].value);
            }
        }
    });

    React.useEffect(() => {
        if (command) {
            executeCommand(command);
        }
    }, [command]);

    const items = [
        { label: '初始化配置', value: 'init' },
        { label: '扫描预览', value: 'scan' },
        { label: '执行转换', value: 'transform' },
        { label: '撤销上次操作', value: 'revert' },
        { label: '增量更新', value: 'update' }
    ];

    const executeCommand = async (cmd) => {
        safeSetState(() => {
            setStatus('loading');
            setProgress(null);
        });

        try {
            switch (cmd) {
                case 'init':
                    safeSetState(() => setInitStep(0));
                    break;
                case 'scan':
                    const scanResults = await require('../commands/scan').execute(flags);
                    safeSetState(() => {
                        setResults(scanResults.map(item => ({
                            type: 'info',
                            text: `${item.file}: ${item.text}`
                        })));
                    });
                    break;
                case 'transform':
                    const transformResults = await require('../commands/transform').execute({
                        ...flags,
                        onProgress: (info) => {
                            safeSetState(() => setProgress(info));
                        }
                    });
                    safeSetState(() => {
                        setResults([{
                            ...transformResults.summary
                        }]);
                        setStatus('done');
                    });
                    if (command === 'transform') {
                        setTimeout(() => {
                            process.exit(0);
                        }, 1000);
                    }
                    break;
                case 'revert':
                    const revertResults = await require('../commands/revert').execute(flags);
                    safeSetState(() => {
                        setResults([{
                            type: 'success',
                            text: `已恢复到 ${revertResults.timestamp} 的版本`
                        }]);
                    });
                    break;
                case 'update':
                    const updateResults = await require('../commands/update').execute(flags);
                    safeSetState(() => {
                        setResults([{
                            type: 'success',
                            text: `发现 ${updateResults.totalNew} 个新文本，已更新语言文件`
                        }]);
                    });
                    break;
                default:
                    setResults([{
                        type: 'error',
                        text: `未知命令: ${cmd}`
                    }]);
            }
        } catch (error) {
            safeSetState(() => setResults([{
                type: 'error',
                text: error.message || '执行出错'
            }]));
            safeSetState(() => setStatus('done'));
        }
    };

    const handleSelect = (item) => {
        executeCommand(item.value);
    };

    const handleInitInput = (value) => {
        const currentStep = initSteps[initStep];
        const answer = value || currentStep.initial;
        const lastAnswer = answers[answers.length - 1];
        if (lastAnswer && lastAnswer.message === currentStep.message) {
            return;
        }
        
        setInitAnswers(prev => ({
            ...prev,
            [currentStep.name]: answer
        }));
        setAnswers(prev => [
            ...prev,
            {
                message: currentStep.message,
                answer
            }
        ]);
        
        if (initStep >= initSteps.length - 1) {
            finishInit();
        } else {
            setInitStep(prev => prev + 1);
            setCurrentInput('');
        }
    };

    const finishInit = async () => {
        safeSetState(() => setStatus('loading'));
        const targetLangs = initAnswers.targetLangs?.split(',').filter(Boolean) || ['en-US'];
        const keyStyle = initAnswers.keyStyle || 'snake_case';

        console.log('Selected keyStyle:', keyStyle);

        const initResults = await require('../commands/init').execute({
            ...flags,
            config: flags.config,
            sourceDir: initAnswers.sourceDir,
            localeDir: initAnswers.localeDir,
            sourceLang: initAnswers.sourceLang,
            targetLangs,
            keyStyle
        });
        safeSetState(() => setResults([{
            type: initResults.type,
            text: initResults.text
        }]));
        safeSetState(() => {
            setStatus('done');
            setInitStep(initSteps.length);
        });

        if (command === 'init') {
            setTimeout(() => {
                process.exit(0);
            }, 100);
        }
    };

    return (
        <Box flexDirection="column">
            {!command && (
                <>
                    <Text bold>请选择要执行的操作：</Text>
                    <Box marginY={1}>
                        <SelectInput items={items} onSelect={handleSelect} />
                    </Box>
                </>
            )}
            
            {status === 'loading' && command !== 'init' && (
                <Box flexDirection="column">
                    <Text>
                        <Spinner /> 正在执行...
                    </Text>
                    {progress && (
                        <Box flexDirection="column" marginTop={1} width={100}>
                            <Text>
                                {progress.text}
                            </Text>
                            <Box>
                                <Text color="yellow">
                                    [{progress.current}/{progress.total}] {Math.round((progress.current / progress.total) * 100)}%
                                </Text>
                            </Box>
                        </Box>
                    )}
                </Box>
            )}

            {command === 'init' && initStep < initSteps.length && (
                <Box flexDirection="column">
                    {answers.map((answer, index) => (
                        <Box key={index} marginY={0}>
                            <Box marginRight={1}>
                                <Text color="green">✔</Text>
                            </Box>
                            <Text color="gray">{answer.message} </Text>
                            <Text color="cyan">{answer.answer}</Text>
                        </Box>
                    ))}
                    <Box marginY={1}>
                        <Box marginRight={1}>
                            <Text color="cyan">?</Text>
                        </Box>
                        <Text>{initSteps[initStep].message} </Text>
                        {initSteps[initStep].type === 'select' ? (
                            <Text color="gray">
                                {initSteps[initStep].choices[selectedChoice].title}
                            </Text>
                        ) : (
                            <TextInput
                                value={currentInput}
                                onChange={setCurrentInput}
                                onSubmit={handleInitInput}
                                showCursor={true}
                                placeholder={initSteps[initStep].initial}
                            />
                        )}
                    </Box>
                    {initSteps[initStep].type === 'select' && (
                        <Box marginLeft={2} flexDirection="column">
                            {initSteps[initStep].choices.map((choice, index) => (
                                <Box key={index}>
                                    <Box marginRight={1}>
                                        <Text color="blue">
                                            {index === selectedChoice ? '❯' : ' '}
                                        </Text>
                                    </Box>
                                    <Text color={index === selectedChoice ? 'cyan' : 'white'}>
                                        {choice.title}
                                    </Text>
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            )}

            {status === 'done' && results.map((item, index) => {
                switch (item.type) {
                    case 'error':
                        return <Text key={index} color="red">✖ {item.text}</Text>;
                    case 'success':
                        return <Text key={index} color="green">✔ {item.text}</Text>;
                    case 'info':
                        return <Text key={index} color="blue">ℹ {item.text}</Text>;
                    default:
                        return <Text key={index}>{item.text}</Text>;
                }
            })}
        </Box>
    );
};

module.exports = App; 
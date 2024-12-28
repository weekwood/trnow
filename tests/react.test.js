const { execute: scan } = require('../src/commands/scan');
const { execute: transform } = require('../src/commands/transform');
const fs = require('fs-extra');
const path = require('path');

describe('React 文件处理', () => {
    const testDir = path.join(__dirname, 'fixtures/react');
    const localeDir = path.join(testDir, 'locales');

    beforeEach(async () => {
        await fs.ensureDir(testDir);
        await fs.ensureDir(localeDir);
        
        // 创建测试用的 JSX 文件
        await fs.writeFile(path.join(testDir, 'UserList.jsx'), `
            import React from 'react';
            import { useTranslation } from 'react-i18next';

            const UserList = () => {
                const messages = {
                    title: '用户列表',
                    empty: '暂无数据'
                };

                return (
                    <div>
                        <h1>用户管理系统</h1>
                        <Button aria-label="新增用户">
                            添加
                        </Button>
                        <Input 
                            placeholder="请输入搜索关键词"
                            title="搜索提示"
                        />
                        <Table 
                            emptyText="没有找到相关数据"
                            columns={[
                                { title: '用户名称' },
                                { title: '操作' }
                            ]}
                        />
                    </div>
                );
            };

            export default UserList;
        `);
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    test('扫描 React 文件中的中文文本', async () => {
        const results = await scan({ src: testDir });
        
        expect(results).toContainEqual(expect.objectContaining({
            text: '用户管理系统',
            type: 'jsx'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '新增用户',
            type: 'jsx'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '添加',
            type: 'jsx'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '请输入搜索关键词',
            type: 'jsx'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '搜索提示',
            type: 'jsx'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '没有找到相关数据',
            type: 'jsx'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '用户名称',
            type: 'jsx'
        }));
        expect(results).toContainEqual(expect.objectContaining({
            text: '操作',
            type: 'jsx'
        }));
    });

    (process.env.AI_API_KEY ? test : test.skip)('转换 React 文件中的中文文本', async () => {
        const flags = {
            src: testDir,
            localeDir,
            sourceLang: 'zh-CN',
            keyStyle: 'camelCase',
            config: '.trnow.yml'
        };

        // 创建测试配置文件
        await fs.writeJson(path.join(testDir, '.trnow.yml'), {
            keyGeneration: {
                style: 'camelCase',
                ai: {
                    enabled: false  // 测试时禁用 AI
                }
            }
        });

        await transform(flags);

        const content = await fs.readFile(path.join(testDir, 'UserList.jsx'), 'utf-8');
        
        // 检查 JSX 转换
        expect(content).toContain('{t(\'yonghuGuanlixitong\')}');
        expect(content).toContain('aria-label={t(\'xinzengYonghu\')}');
        expect(content).toContain('{t(\'tianjia\')}');
        expect(content).toContain('placeholder={t(\'qingShuruSousuoGuanjianci\')}');
        expect(content).toContain('title={t(\'sousuoTishi\')}');
        expect(content).toContain('emptyText={t(\'meiyouZhaodaoXiangguanShuju\')}');
        expect(content).toContain('title: t(\'yonghuMingcheng\')');
        expect(content).toContain('title: t(\'caozuo\')');

        // 检查生成的语言文件
        const messages = await fs.readJson(path.join(localeDir, 'zh-CN.json'));
        expect(messages).toMatchObject({
            yonghuGuanlixitong: '用户管理系统',
            xinzengYonghu: '新增用户',
            tianjia: '添加',
            qingShuruSousuoGuanjianci: '请输入搜索关键词',
            sousuoTishi: '搜索提示',
            meiyouZhaodaoXiangguanShuju: '没有找到相关数据',
            yonghuMingcheng: '用户名称',
            caozuo: '操作'
        });
    });
}); 
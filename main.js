new Vue({
    el: '#app',
    data: {
        messages: [],
        apiUrl: localStorage.getItem('apiUrl') || '',
        maxHistorySize: parseInt(localStorage.getItem('maxHistorySize')) || 10,
        configJson: localStorage.getItem('configJson') || JSON.stringify({
            data: {
                model: "model-name",
                chat_histories: [],
                user: {
                    name: "User"
                },
                content: "",
                character: {
                    name: "Assistant",
                    personality: "professional, helpful, and friendly"
                },
                language: "English"
            }
        }, null, 2),
        userInput: '',
        chatStarted: false,
        lastResponse: null,
        lastRequest: null,
        showDebug: false,
        currentConfig: null,
        isSending: false
    },
    watch: {
        apiUrl(newValue) {
            localStorage.setItem('apiUrl', newValue);
        },
        maxHistorySize(newValue) {
            localStorage.setItem('maxHistorySize', newValue);
        },
        configJson: {
            handler(newValue) {
                try {
                    JSON.parse(newValue);
                    localStorage.setItem('configJson', newValue);
                } catch (e) {
                    console.warn('配置JSON格式错误，未保存到本地存储');
                }
            },
            deep: true
        }
    },
    computed: {
        parsedResponse() {
            if (!this.lastResponse) return {};
            try {
                const response = JSON.parse(this.lastResponse);
                if (response.result && response.result.prompt1) {
                    response.result.prompt1 = this.formatPrompt(response.result.prompt1);
                }
                return response;
            } catch (e) {
                return { error: '解析响应数据失败' };
            }
        },
        debugData() {
            return {
                request: this.lastRequest ? JSON.parse(this.lastRequest) : null,
                response: this.parsedResponse
            };
        }
    },
    methods: {
        getBaseUrl(url) {
            try {
                const urlObj = new URL(url);
                return `${urlObj.protocol}//${urlObj.host}`;
            } catch (e) {
                return '';
            }
        },
        getPath(url) {
            try {
                const urlObj = new URL(url);
                return urlObj.pathname + urlObj.search;
            } catch (e) {
                return '';
            }
        },
        clearLocalStorage() {
            if (confirm('确定要清除所有本地保存的配置吗？刷新页面后将恢复默认设置。')) {
                localStorage.removeItem('apiUrl');
                localStorage.removeItem('maxHistorySize');
                localStorage.removeItem('configJson');
                alert('本地配置已清除，刷新页面后将恢复默认设置');
            }
        },
        copyMessages() {
            try {
                const chatHistories = JSON.stringify(this.messages, null, 2);
                
                const textarea = document.createElement('textarea');
                textarea.value = chatHistories;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);

                const button = event.target.closest('.icon-button');
                if (button) {
                    button.classList.add('copy-success');
                    setTimeout(() => {
                        button.classList.remove('copy-success');
                    }, 500);
                }
            } catch (error) {
                console.error('复制失败:', error);
                alert('复制失败，请重试');
            }
        },
        copyDebugInfo(type) {
            let content = '';
            
            try {
                switch(type) {
                    case 'request':
                        content = this.lastRequest;
                        break;
                    case 'response':
                        content = this.lastResponse;
                        break;
                    case 'all':
                        content = JSON.stringify({
                            request: this.debugData.request,
                            response: this.debugData.response
                        }, null, 2);
                        break;
                }

                const textarea = document.createElement('textarea');
                textarea.value = content;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);

                const button = event.target.closest('.icon-button');
                if (button) {
                    button.classList.add('copy-success');
                    setTimeout(() => {
                        button.classList.remove('copy-success');
                    }, 500);
                }
            } catch (error) {
                console.error('复制失败:', error);
                alert('复制失败，请重试');
            }
        },
        isUserMessage(message) {
            if (!this.currentConfig) return false;
            
            const userName = this.currentConfig.data.user?.name;
            const aiName = this.currentConfig.data.character?.name;
            
            if (message.sender_name === userName) return true;
            if (message.sender_name === aiName) return false;
            
            if (!message.sender_name) {
                return message.role === 'user' || message.is_user === true;
            }
            
            return message.sender_name !== aiName;
        },
        startChat() {
            try {
                const config = JSON.parse(this.configJson);
                this.currentConfig = config;
                
                if (config.data && config.data.chat_histories && Array.isArray(config.data.chat_histories)) {
                    const processedMessages = config.data.chat_histories.map(msg => {
                        const userName = config.data.user?.name;
                        const aiName = config.data.character?.name;
                        
                        if (!msg.sender_name) {
                            if (msg.role === 'user' || msg.is_user) {
                                msg.sender_name = userName;
                            } else if (msg.role === 'assistant' || msg.is_ai) {
                                msg.sender_name = aiName;
                            }
                        }
                        
                        if (msg.sender_name === userName) {
                            msg.role = 'user';
                        } else if (msg.sender_name === aiName) {
                            msg.role = 'assistant';
                        } else if (!msg.role) {
                            msg.role = msg.sender_name === aiName ? 'assistant' : 'user';
                        }
                        
                        return msg;
                    });

                    this.messages = processedMessages;
                    
                    this.$nextTick(() => {
                        const chatMessages = this.$refs.chatMessages;
                        if (chatMessages) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    });
                }
                
                this.chatStarted = true;
            } catch (e) {
                console.error('配置解析错误:', e);
                alert('配置JSON格式不正确，请检查');
                return;
            }
        },
        clearChat() {
            if (confirm('确定要清除所有聊天记录吗？')) {
                this.messages = [];
                this.lastResponse = null;
                this.lastRequest = null;
            }
        },
        getRecentMessages(count) {
            return this.messages.slice(-count);
        },
        highlightJson(obj) {
            const str = JSON.stringify(obj, null, 2);
            return hljs.highlight(str, {language: 'json'}).value;
        },
        formatPrompt(prompt) {
            return prompt.split('\n').map(line => {
                const spaces = line.match(/^\s*/)[0];
                const content = line.trim();
                return spaces + content;
            }).join('\n');
        },
        async sendMessage() {
            if (!this.userInput.trim() || this.isSending) return;

            this.isSending = true;
            const userMessage = {
                sender_name: this.currentConfig.data.user?.name || '',
                content: this.userInput,
                role: 'user'
            };

            const currentInput = this.userInput;
            this.userInput = '';

            try {
                const config = JSON.parse(this.configJson);
                config.data.chat_histories = this.getRecentMessages(this.maxHistorySize);
                config.data.content = currentInput;

                this.lastRequest = JSON.stringify(config, null, 2);

                const baseUrl = this.getBaseUrl(this.apiUrl);
                const path = this.getPath(this.apiUrl);

                const response = await axios.post('/proxy' + path, config, {
                    headers: {
                        'X-Target-URL': baseUrl
                    }
                });
                
                this.lastResponse = JSON.stringify(response.data, null, 2);
                
                this.messages.push(userMessage);
                
                if (response.data && response.data.result && response.data.result.response) {
                    const botMessage = {
                        sender_name: config.data.character?.name,
                        content: response.data.result.response,
                        role: 'assistant'
                    };
                    this.messages.push(botMessage);
                }
            } catch (error) {
                console.error('Error:', error);
                this.lastResponse = JSON.stringify({
                    error: error.message,
                    response: error.response ? error.response.data : null
                }, null, 2);
                alert('发送消息失败，请检查网络连接和API地址');
                this.userInput = currentInput;
            } finally {
                this.isSending = false;
            }
            
            this.$nextTick(() => {
                const chatMessages = this.$refs.chatMessages;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
        }
    }
}); 
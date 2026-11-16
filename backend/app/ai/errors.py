class AIProviderError(RuntimeError):
    def __init__(
        self,
        provider: str,
        code: str,
        *,
        status_code: int | None = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(f"{provider} provider request failed ({code}).")
        self.provider = provider
        self.code = code
        self.status_code = status_code
        self.retryable = retryable

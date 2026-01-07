# Contributing to Baby Logger

Thank you for your interest in contributing to Baby Logger! We welcome contributions of all kinds, including bug fixes, new features, and improvements to documentation.

## How to Contribute

### Reporting Bugs
If you find a bug, please open an issue on GitHub. Include as much detail as possible:
- A clear and descriptive title.
- Steps to reproduce the issue.
- Expected behavior vs. actual behavior.
- Screenshots if applicable.

### Suggesting Features
We love new ideas! If you have a feature request, please open an issue and describe:
- The problem you want to solve.
- How the proposed feature would work.
- Any potential alternatives.

### Submitting Pull Requests
1.  **Fork the repository** to your own GitHub account.
2.  **Clone the fork** to your local machine:
    ```bash
    git clone https://github.com/your-username/baby-logger.git
    ```
3.  **Create a new branch** for your changes:
    ```bash
    git checkout -b feature/your-feature-name
    ```
4.  **Make your changes**. Ensure your code follows the project's existing style and conventions.
5.  **Test your changes**. Run the project locally to make sure everything works as expected.
6.  **Commit your changes** with a clear and concise commit message.
7.  **Push your branch** to your fork:
    ```bash
    git push origin feature/your-feature-name
    ```
8.  **Open a Pull Request** against the `main` branch of the original repository.

## Development Setup

### Prerequisites
- **Go** (1.18+)
- **Node.js & npm** (only for rebuilding the frontend)

### Building and Running
You can use the `Makefile` to simplify development:
- `make build`: Compiles TypeScript and Go binary.
- `make run`: Builds and runs the binary.
- `make clean`: Removes build artifacts.

For more details, see the [README.md](README.md).

## Coding Standards
- Mimic the existing style and structure of the codebase.
- Keep functions small and focused.
- Add comments only where necessary for clarity.
- Ensure TypeScript types are correctly defined.

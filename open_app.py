
import webbrowser
import os

def main():
    path = os.path.abspath('index.html')
    url = f'file:///{path}'
    print(f"Opening {url} in your default browser...")
    webbrowser.open(url)

if __name__ == '__main__':
    main()

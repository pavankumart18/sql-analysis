
import json

def main():
    try:
        with open('app_data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        js_content = f"const APP_DATA = {json.dumps(data)};"
        
        with open('data.js', 'w', encoding='utf-8') as f:
            f.write(js_content)
            
        print("Successfully created data.js")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()


import requests
import json

def list_models():
    api_key = "AIzaSyAwzBCfDm8xycNgOEJXw8Uq7xRdIlBdMmY"
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    
    try:
        response = requests.get(url)
        data = response.json()
        if "models" in data:
            for model in data["models"]:
                print(model["name"])
        else:
            print("No models found in response:", data)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    list_models()

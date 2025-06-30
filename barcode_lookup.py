import requests

def lookup_barcode(barcode: str):
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    response = requests.get(url)
    data = response.json()

    if data.get("status") == 1:
        product = data["product"]
        print("Product Name:", product.get("product_name"))
        print("Ingredients:", product.get("ingredients_text"))
        print("Allergens:", product.get("allergens_tags"))
        return {
            "name": product.get("product_name"),
            "ingredients": product.get("ingredients_text"),
            "allergens": product.get("allergens_tags"),
        }
    else:
        print("Product not found")
        return None

if __name__ == "__main__":
    # Example: Coca-Cola (300 ml) barcode
    barcode = "5449000000996"
    lookup_barcode(barcode) 
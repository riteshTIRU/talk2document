from django.urls import path
from . import views

urlpatterns = [
    path('csrf/', views.get_csrf, name='get_csrf'),
    path('chat/', views.api_chat, name='api_chat'),
    path('upload/',views.api_upload, name='api_upload'),
]

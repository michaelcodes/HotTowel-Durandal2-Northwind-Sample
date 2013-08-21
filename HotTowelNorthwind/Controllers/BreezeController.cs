using Breeze.WebApi;
using HotTowelNorthwind.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;

namespace HotTowelNorthwind.Controllers
{
    [BreezeController]
    public class BreezeController : ApiController
    {
        readonly EFContextProvider<NorthwindContext> _contextProvider =
            new EFContextProvider<NorthwindContext>();

        [System.Web.Http.HttpGet]
        public string Metadata()
        {
            return _contextProvider.Metadata();
        }

        [System.Web.Http.HttpPost]
        public SaveResult SaveChanges(JObject saveBundle)
        {
            SaveResult saveResult = _contextProvider.SaveChanges(saveBundle);
            #region Additionnal
            //foreach (object savedEntity in saveResult.Entities)
            //{
            //    if (savedEntity is Restaurant)
            //    {
            //        RestaurantsHub.RestaurantUpdated((Restaurant)savedEntity);
            //    }
            //    else if (savedEntity is MenuItem)
            //    {
            //    }
            //}
            #endregion
            return saveResult;
        }

        private static JsonSerializer CreateJsonSerializer()
        {
            var serializerSettings = BreezeConfig.Instance.GetJsonSerializerSettings();
            var jsonSerializer = JsonSerializer.Create(serializerSettings);
            return jsonSerializer;
        }

        [System.Web.Http.HttpGet]
        public IQueryable<Customer> Customers()
        {
            //System.Threading.Thread.Sleep(500);
            return _contextProvider.Context.Customers;
        }

        [System.Web.Http.HttpGet]
        public IQueryable<Order> Orders()
        {
            //System.Threading.Thread.Sleep(500);
            return _contextProvider.Context.Orders;
        }

        //[System.Web.Http.HttpGet]
        //public IQueryable<MenuItem> MenuItems()
        //{
        //    return _contextProvider.Context.MenuItems;
        //}

        //[System.Web.Http.HttpGet]
        //public IQueryable<RestaurantBrief> RestaurantBriefs()
        //{
        //    return _contextProvider.Context.Restaurants.Select(
        //            restaurant =>
        //                new RestaurantBrief
        //                {
        //                    Id = restaurant.Id,
        //                    Name = restaurant.Name,
        //                    Description = restaurant.Description,
        //                    Address = restaurant.Address
        //                }
        //        );
        //}
    }
}
